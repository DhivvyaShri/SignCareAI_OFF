import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  AlertTriangle,
  Camera, 
  Check, 
  ChevronRight, 
  Edit3, 
  Eye, 
  Lock, 
  Pause, 
  Play, 
  RotateCcw, 
  Sparkles,
  Square, 
  Trash2, 
  Video, 
  VideoOff, 
  Volume2, 
  X,
  Zap
} from 'lucide-react';

export default function ContinuousISLRecognition({ 
  apiBaseUrl, 
  onConfirmSentence, 
  manualFallbackText, 
  setManualFallbackText 
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [signingState, setSigningState] = useState('idle'); // 'idle' | 'recording' | 'paused' | 'capturing_clip'
  
  // Continuous stream tokens: { id, text, confidence, timestamp, isManual, isUnknown, source }
  const [recognizedTokens, setRecognizedTokens] = useState([]);
  const [bufferCount, setBufferCount] = useState(0);
  const [framesTotalCaptured, setFramesTotalCaptured] = useState(0);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editWordInput, setEditWordInput] = useState('');
  const [sentenceDraft, setSentenceDraft] = useState('');
  const [unknownSignWarning, setUnknownSignWarning] = useState('');
  const [backendStatus, setBackendStatus] = useState('Checking sequence service...');
  const [isProcessingWindow, setIsProcessingWindow] = useState(false);
  const [clipProgress, setClipProgress] = useState(0); // 0 to 100 for 2-sec capture

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const bufferTimerRef = useRef(null);
  const framesBufferRef = useRef([]); // holds sampled frames for continuous window

  // Check backend continuous status on mount & periodically
  useEffect(() => {
    let cancelled = false;
    async function checkHealth() {
      try {
        const res = await fetch(`${apiBaseUrl}/health`, { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        if (cancelled) return;
        if (data.continuous_model_loaded && data.continuous_model_status === 'ready') {
          const vocab = data.classes || [];
          setBackendStatus(`Continuous ISL Sequence Model Active (${vocab.length} signs: ${vocab.slice(0, 4).join(', ')}...)`);
        } else {
          const detector = data.landmark_detector_status === 'ready' ? 'MediaPipe hand detector ready' : (data.messages?.landmark_detector || 'MediaPipe hand detector unavailable');
          setBackendStatus(`ISL model not ready. ${detector}. Add verified real training videos before recognition; manual text entry is available.`);
        }
      } catch {
        if (!cancelled) setBackendStatus('Backend service offline (Start isl-backend/app.py on port 8000)');
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => { 
      cancelled = true; 
      clearInterval(interval);
    };
  }, [apiBaseUrl]);

  // Sync sentenceDraft whenever recognizedTokens change
  useEffect(() => {
    const validWords = recognizedTokens
      .filter(t => !t.isUnknown && t.text)
      .map(t => t.text);
    setSentenceDraft(validWords.join(' '));
  }, [recognizedTokens]);

  // Callback ref to attach stream immediately as soon as video element exists
  const setVideoRef = useCallback((node) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current;
      }
      node.onloadedmetadata = () => {
        node.play().catch(e => console.warn('Video play onloadedmetadata:', e));
      };
      node.play().catch(e => console.warn('Video play immediate:', e));
    }
  }, []);

  // Ensure stream is attached when cameraActive toggles
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(e => console.warn('Video play effect:', e));
    }
  }, [cameraActive]);

  // Camera Toggle with robust fallback constraints
  const toggleCamera = async () => {
    if (cameraActive) {
      stopCamera();
      return;
    }
    setCameraError('');

    try {
      let stream = null;

      // Primary attempt: standard ideal dimensions with user facing mode
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, min: 320 },
            height: { ideal: 480, min: 240 },
            facingMode: 'user'
          },
          audio: false
        });
      } catch (err1) {
        console.warn('Constrained getUserMedia failed, trying fallback video constraint...', err1);
        // Fallback attempt: basic unconstrained video
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      if (!stream) {
        throw new Error('No media stream obtained.');
      }

      streamRef.current = stream;
      setCameraActive(true);

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.warn('Play error on start:', e));
        };
        videoRef.current.play().catch(e => console.warn('Play error on start:', e));
      }

      // Automatically start capturing sequence frames right away!
      startContinuousSampling(stream);

    } catch (err) {
      console.error('Camera startup error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was blocked by your browser. Click the camera or lock icon in the browser address bar, choose "Allow", and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No webcam was found on this computer. Please connect a USB camera and reload.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is already in use by another application (Zoom, Teams, or browser tab). Please close other apps and try again.');
      } else {
        setCameraError(`Camera error: ${err.message || 'Unable to open video stream.'}`);
      }
    }
  };

  const stopCamera = () => {
    if (bufferTimerRef.current) {
      clearInterval(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setSigningState('idle');
    framesBufferRef.current = [];
    setBufferCount(0);
    setClipProgress(0);
  };

  // Continuous frame sampling loop (10 FPS)
  const startContinuousSampling = (activeStream = null) => {
    setSigningState('recording');
    setUnknownSignWarning('');
    framesBufferRef.current = [];
    setBufferCount(0);

    if (bufferTimerRef.current) {
      clearInterval(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    bufferTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      // Check if video is playing and ready
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        if (video.paused && streamRef.current) {
          video.play().catch(() => {});
        }
        return;
      }

      try {
        ctx.drawImage(video, 0, 0, 320, 240);
        const frameData = canvas.toDataURL('image/jpeg', 0.65);
        framesBufferRef.current.push(frameData);
        
        setBufferCount(framesBufferRef.current.length);
        setFramesTotalCaptured(prev => prev + 1);

        // When 20 frames are gathered (~2 seconds), process sliding window
        if (framesBufferRef.current.length >= 20) {
          const windowToProcess = [...framesBufferRef.current];
          // Sliding window step: keep last 10 frames (50% temporal overlap)
          framesBufferRef.current = framesBufferRef.current.slice(10);
          processContinuousWindow(windowToProcess);
        }
      } catch (drawErr) {
        console.warn('Canvas drawFrame error:', drawErr);
      }
    }, 100);
  };

  const pauseSampling = () => {
    if (bufferTimerRef.current) {
      clearInterval(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
    setSigningState('paused');
  };

  const resumeSampling = () => {
    startContinuousSampling();
  };

  const clearRecording = () => {
    framesBufferRef.current = [];
    setBufferCount(0);
    setRecognizedTokens([]);
    setSentenceDraft('');
    setUnknownSignWarning('');
    if (cameraActive) {
      setSigningState('recording');
    } else {
      setSigningState('idle');
    }
  };

  // Dedicated 2-Second Isolated Sign Capture
  const captureTwoSecondClip = async () => {
    const video = videoRef.current;
    if (!cameraActive || !video || video.readyState < 2 || !video.videoWidth) {
      setCameraError('Start the camera first and keep your hands visible in the frame.');
      return;
    }

    // Temporarily pause continuous loop while recording dedicated clip
    if (bufferTimerRef.current) {
      clearInterval(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }

    setSigningState('capturing_clip');
    setClipProgress(10);
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    const dedicatedFrames = [];

    try {
      for (let i = 0; i < 20; i++) {
        if (video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, 320, 240);
          dedicatedFrames.push(canvas.toDataURL('image/jpeg', 0.65));
        }
        setClipProgress(Math.round(((i + 1) / 20) * 100));
        await new Promise(r => setTimeout(r, 100));
      }

      if (dedicatedFrames.length >= 5) {
        await processContinuousWindow(dedicatedFrames);
      }
    } finally {
      setClipProgress(0);
      if (cameraActive) {
        startContinuousSampling();
      } else {
        setSigningState('idle');
      }
    }
  };

  // Call backend continuous recognition endpoint
  const processContinuousWindow = async (frames) => {
    if (isProcessingWindow || !frames || frames.length < 4) return;
    setIsProcessingWindow(true);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      const response = await fetch(`${apiBaseUrl}/predict-continuous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames })
      });

      const data = await response.json();

      if (response.ok && data.prediction) {
        const confidenceScore = Math.round((data.confidence || 0) * 100);
        
        // Keep the UI conservative until backend model metadata reports its validated threshold.
        if (confidenceScore >= Math.round((data.confidence_threshold ?? 0.65) * 100)) {
          setRecognizedTokens(prev => {
            const last = prev[prev.length - 1];
            // Deduplicate immediately identical consecutive predictions
            if (last && last.text === data.prediction && !last.isUnknown) {
              return prev;
            }
            return [
              ...prev,
              {
                id: `tok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                text: data.prediction,
                confidence: confidenceScore,
                timestamp: nowTime,
                isManual: false,
                isUnknown: false,
                source: 'AI Continuous Model'
              }
            ];
          });
          setUnknownSignWarning('');
        } else {
          handleUnknownSign(nowTime, confidenceScore);
        }
      } else {
        if (data.status === 'model_not_ready') {
          setBackendStatus(data.message || 'ISL model not ready. Manual text entry remains available.');
          setUnknownSignWarning('Recognition is unavailable until a verified real ISL model is installed. Type your message below.');
        } else if (data.unknown) {
          handleUnknownSign(nowTime, Math.round((data.confidence || 0) * 100));
        }
      }
    } catch (err) {
      console.warn('Continuous sequence inference offline notice:', err);
    } finally {
      setIsProcessingWindow(false);
    }
  };

  const handleUnknownSign = (timeStr, conf) => {
    setUnknownSignWarning('Sign not recognized with sufficient certainty — please repeat sign or type below.');
    // Only append unknown token if the last token was not already unknown
    setRecognizedTokens(prev => {
      const last = prev[prev.length - 1];
      if (last && last.isUnknown) return prev;
      return [
        ...prev,
        {
          id: `unk_${Date.now()}`,
          text: '[Unrecognized Sign]',
          confidence: conf || 0,
          timestamp: timeStr,
          isManual: false,
          isUnknown: true,
          source: 'Low Confidence'
        }
      ];
    });
  };

  // Word In-Place Editing
  const startEditWord = (index) => {
    setEditingIndex(index);
    setEditWordInput(recognizedTokens[index].text.replace(/^\[|\]$/g, ''));
  };

  const saveEditWord = (index) => {
    if (!editWordInput.trim()) return;
    setRecognizedTokens(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        text: editWordInput.trim().toUpperCase(),
        isManual: true,
        isUnknown: false,
        source: 'Patient Corrected'
      };
      return next;
    });
    setEditingIndex(null);
    setEditWordInput('');
  };

  const removeWord = (index) => {
    setRecognizedTokens(prev => prev.filter((_, idx) => idx !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  // Confirmation to Patient Medical Report
  const handleConfirmInterpretation = () => {
    const textToSubmit = (sentenceDraft || manualFallbackText || '').trim();
    if (!textToSubmit) return;

    const confirmedData = {
      confirmedText: textToSubmit,
      rawTokens: [...recognizedTokens],
      modelInfo: 'ISL Continuous Sequence GRU/Landmark v2.0',
      confirmedAt: new Date().toISOString(),
      wasManuallyEdited: recognizedTokens.some(t => t.isManual) || Boolean(manualFallbackText && !recognizedTokens.length)
    };

    onConfirmSentence(confirmedData);
    clearRecording();
  };

  return (
    <div className="continuous-isl-card" aria-label="Full Continuous ISL Recognition Console">
      {/* Console Header */}
      <div className="console-header">
        <div className="console-title-wrap">
          <div className="console-badge">LIVE CAMERA CONTINUOUS ISL PIPELINE</div>
          <h4>Continuous Indian Sign Language Camera</h4>
          <p className="console-subtitle">Live camera captures your signs in real-time, extracts landmark sequences, and assembles reviewable sentences.</p>
        </div>
        <div className="service-state-tag">
          <span className={`status-dot ${cameraActive ? 'online' : 'idle'}`} />
          <span>{backendStatus}</span>
        </div>
      </div>

      {/* Camera Video Area */}
      <div className="video-console-stage">
        {/* The video element is ALWAYS mounted to guarantee immediate stream binding */}
        <div 
          className="live-video-wrapper" 
          style={{ display: cameraActive ? 'block' : 'none' }}
        >
          <video 
            ref={setVideoRef}
            autoPlay 
            playsInline 
            muted 
            className="live-video-element"
          />

          {/* Real-time Overlay HUD */}
          <div className="hud-overlay">
            <div className="hud-left">
              <span className={`hud-record-indicator ${signingState === 'recording' || signingState === 'capturing_clip' ? 'blinking' : ''}`}>
                ● {signingState === 'capturing_clip' ? 'CAPTURING 2S SIGN' : signingState.toUpperCase()}
              </span>
              <span className="hud-buffer">Buffer: {bufferCount}/20 frames</span>
              <span className="hud-buffer">Total: {framesTotalCaptured} frames</span>
            </div>
            <div className="hud-right">
              {isProcessingWindow && (
                <span className="privacy-badge" style={{ background: 'rgba(234, 88, 12, 0.85)', color: '#fff' }}>
                  <Zap size={11} /> Running Inference...
                </span>
              )}
              <span className="privacy-badge">
                <Lock size={11} /> Local Inference
              </span>
            </div>
          </div>

          {/* 2-Second Dedicated Capture Progress Overlay */}
          {clipProgress > 0 && (
            <div className="clip-progress-bar-wrap">
              <div className="clip-progress-fill" style={{ width: `${clipProgress}%` }} />
              <span className="clip-progress-text">Capturing ISL Clip: {clipProgress}%</span>
            </div>
          )}

          {/* Target Hand Framing Box */}
          <div className="hand-framing-guide" aria-hidden="true">
            <span className="guide-corner tl" />
            <span className="guide-corner tr" />
            <span className="guide-corner bl" />
            <span className="guide-corner br" />
            <span className="guide-label">Center Hands & Upper Body in Frame</span>
          </div>
        </div>

        {/* Standby Placeholder shown when camera is off */}
        {!cameraActive && (
          <div className="camera-standby-placeholder">
            <Video size={48} className="standby-icon" />
            <b>Camera in Standby</b>
            <p>Click <strong>"Start Camera"</strong> below. The live video will start capturing your continuous signs locally on this computer.</p>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="console-error-banner" role="alert">
          <AlertTriangle size={18} />
          <div>
            <b>Camera Access Notice</b>
            <p>{cameraError}</p>
          </div>
        </div>
      )}

      {/* Camera and Sequence Action Controls */}
      <div className="console-controls-bar">
        {!cameraActive ? (
          <button 
            type="button" 
            className="primary-btn camera-toggle-btn"
            onClick={toggleCamera}
          >
            <Camera size={16} /> Start Camera & Live Capture
          </button>
        ) : (
          <>
            <button 
              type="button" 
              className="secondary-btn camera-stop-btn"
              onClick={stopCamera}
            >
              <VideoOff size={16} /> Stop Camera
            </button>

            {signingState === 'recording' && (
              <button 
                type="button" 
                className="action-btn pause-btn"
                onClick={pauseSampling}
              >
                <Pause size={16} /> Pause Capture
              </button>
            )}

            {signingState === 'paused' && (
              <button 
                type="button" 
                className="action-btn record-btn"
                onClick={resumeSampling}
              >
                <Play size={16} /> Resume Capture
              </button>
            )}

            <button 
              type="button" 
              className="action-btn process-btn"
              onClick={captureTwoSecondClip}
              disabled={signingState === 'capturing_clip'}
            >
              <Zap size={16} /> Capture 2-Second Sign Clip
            </button>

            <button 
              type="button" 
              className="text-btn clear-rec-btn"
              onClick={clearRecording}
            >
              <RotateCcw size={14} /> Clear Stream
            </button>
          </>
        )}
      </div>

      {/* Low-Confidence / Unknown Sign Alert */}
      {unknownSignWarning && (
        <div className="unknown-sign-alert" role="alert">
          <AlertTriangle size={16} className="alert-icon" />
          <div className="alert-content">
            <b>Sign not recognized with certainty</b>
            <p>{unknownSignWarning}</p>
          </div>
          <button 
            type="button" 
            className="dismiss-alert-btn"
            onClick={() => setUnknownSignWarning('')}
            aria-label="Dismiss warning"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Continuous Stream Breakdown & Token Chips */}
      <div className="stream-tokens-area">
        <div className="tokens-header">
          <span className="tokens-title">Recognized Temporal Sequence:</span>
          <span className="tokens-count">{recognizedTokens.length} token(s) detected</span>
        </div>

        {recognizedTokens.length === 0 ? (
          <div className="empty-tokens-placeholder">
            <span>
              {cameraActive 
                ? 'Camera is actively sampling frames. Perform continuous signs in view (e.g. HELP, PAIN, CHEST_PAIN, DOCTOR, WATER)...' 
                : 'No signs captured yet. Click "Start Camera & Live Capture" to begin.'}
            </span>
          </div>
        ) : (
          <div className="token-chips-row">
            {recognizedTokens.map((token, index) => (
              <div 
                key={token.id || index} 
                className={`token-chip ${token.isUnknown ? 'unknown-chip' : ''} ${token.isManual ? 'manual-chip' : ''}`}
              >
                {editingIndex === index ? (
                  <div className="inline-edit-wrap">
                    <input 
                      type="text" 
                      value={editWordInput}
                      onChange={(e) => setEditWordInput(e.target.value)}
                      className="inline-edit-input"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditWord(index);
                        if (e.key === 'Escape') setEditingIndex(null);
                      }}
                    />
                    <button type="button" onClick={() => saveEditWord(index)} className="save-chip-btn" title="Save word">
                      <Check size={12} />
                    </button>
                    <button type="button" onClick={() => setEditingIndex(null)} className="cancel-chip-btn" title="Cancel">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <b className="chip-word">{token.text}</b>
                    {!token.isUnknown && (
                      <span className="chip-confidence">{token.confidence}%</span>
                    )}
                    <span className="chip-source">{token.isManual ? 'Edited' : token.source}</span>
                    <button 
                      type="button" 
                      onClick={() => startEditWord(index)} 
                      className="chip-edit-icon"
                      title="Edit this word"
                    >
                      <Edit3 size={11} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => removeWord(index)} 
                      className="chip-del-icon"
                      title="Remove"
                    >
                      <X size={11} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assembled Sentence Review & Correction Screen */}
      <div className="sentence-assembly-review">
        <label htmlFor="sentence-draft-editor" className="assembly-label">
          Assembled Interpretation (Patient Review & Edit Before Confirmation):
        </label>
        <textarea 
          id="sentence-draft-editor"
          rows={3}
          value={sentenceDraft}
          onChange={(e) => setSentenceDraft(e.target.value)}
          placeholder="Recognized words will form a reviewable sentence here. You can edit any word freely..."
          className="sentence-draft-textarea"
        />

        {/* Manual Fallback Entry */}
        <div className="manual-fallback-group">
          <label htmlFor="manual-entry-box" className="manual-label">
            Manual Text Entry Fallback (always accessible):
          </label>
          <input 
            id="manual-entry-box"
            type="text"
            value={manualFallbackText}
            onChange={(e) => setManualFallbackText(e.target.value)}
            placeholder="Type your message if a sign is unrecognized or camera is unavailable..."
            className="manual-input"
          />
        </div>

        {/* Confirmation & Rejection Action Buttons */}
        <div className="review-action-row">
          <button 
            type="button" 
            className="reject-btn"
            onClick={clearRecording}
            disabled={!sentenceDraft && !manualFallbackText && recognizedTokens.length === 0}
          >
            <Trash2 size={15} /> Reject Prediction
          </button>
          
          <button 
            type="button" 
            className="primary-btn confirm-btn"
            onClick={handleConfirmInterpretation}
            disabled={!sentenceDraft.trim() && !manualFallbackText.trim()}
          >
            <Check size={16} /> Confirm Interpretation & Add to Report
          </button>
        </div>

        <p className="clinical-accuracy-note">
          <strong>Patient Safety Notice:</strong> ISL recognition predictions are AI candidates only and must be confirmed by the patient before being added to the official medical communication report. Never use unconfirmed predictions for clinical decisions.
        </p>
      </div>
    </div>
  );
}
