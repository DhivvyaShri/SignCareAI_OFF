import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  Check, 
  CheckCircle, 
  ChevronRight, 
  Clock, 
  Download, 
  FileCheck, 
  FileText, 
  Languages, 
  MessageSquare, 
  Mic, 
  MicOff, 
  Printer, 
  RefreshCw, 
  Send, 
  ShieldCheck, 
  Stethoscope, 
  User, 
  Volume2, 
  X,
  Sparkles
} from 'lucide-react';
import { ANATOMICAL_REGIONS } from './BodyPainMap';

export default function DoctorDashboard({
  apiBaseUrl,
  reports = [],
  activeReportId,
  onSelectReport,
  onUpdateReportReview,
  onSendClarification,
  doctorSpeechText,
  setDoctorSpeechText,
  isListening,
  startSpeech,
  stopSpeech,
  speechSupported,
  aiMode = 'offline' // 'offline' | 'ollama' | 'nvidia' | 'disabled'
}) {
  const activeReport = reports.find(r => r.id === activeReportId) || reports[0] || null;

  // Clinician notes state
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [clarificationInput, setClarificationInput] = useState('');
  const [reviewedSections, setReviewedSections] = useState({
    profile: false,
    isl: false,
    pain: false,
    questions: false,
    aiSummary: false
  });
  const [aiSummaryText, setAiSummaryText] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activePainTab, setActivePainTab] = useState('front');

  // Load active report notes & status
  useEffect(() => {
    if (activeReport) {
      setClinicianNotes(activeReport.clinicianNotes || '');
      setReviewedSections(activeReport.reviewedSections || {
        profile: false,
        isl: false,
        pain: false,
        questions: false,
        aiSummary: false
      });
      generateOrLoadSummary(activeReport);
    }
  }, [activeReportId, aiMode]);

  const toggleSectionReviewed = (sectionKey) => {
    const next = { ...reviewedSections, [sectionKey]: !reviewedSections[sectionKey] };
    setReviewedSections(next);
    if (activeReport) {
      onUpdateReportReview(activeReport.id, {
        reviewedSections: next,
        clinicianNotes
      });
    }
  };

  const saveClinicianNotes = () => {
    if (!activeReport) return;
    onUpdateReportReview(activeReport.id, {
      clinicianNotes,
      reviewedSections,
      clinicianReviewedAt: new Date().toISOString()
    });
  };

  const handleCompleteConsultation = () => {
    if (!activeReport) return;
    onUpdateReportReview(activeReport.id, {
      status: 'completed',
      clinicianNotes,
      reviewedSections,
      completedAt: new Date().toISOString()
    });
  };

  const sendClarificationMessage = () => {
    const text = (clarificationInput || doctorSpeechText).trim();
    if (!text || !activeReport) return;

    onSendClarification({
      reportId: activeReport.id,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    setClarificationInput('');
    setDoctorSpeechText('');
  };

  // Generate Deterministic or Local AI Summary
  const generateOrLoadSummary = async (report) => {
    if (aiMode === 'disabled') {
      setAiSummaryText('Manual mode is selected. No AI summary was generated.');
      return;
    }
    if (aiMode === 'offline') {
      setAiSummaryText(generateDeterministicSummary(report));
      return;
    }
    const externalConsent = aiMode === 'nvidia' && window.confirm('This sends confirmed sign text, selected pain details, and the patient question to NVIDIA’s hosted AI service. Free text may contain identifying or sensitive details. The patient identifier and camera frames are excluded. Continue?');
    if (aiMode === 'nvidia' && !externalConsent) {
      setAiSummaryText('Hosted AI was canceled. Select Offline Local Mode to create a local template summary.');
      return;
    }
    setIsSummarizing(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/ai/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, aiMode, externalAiConsent: externalConsent })
      });
      const data = await response.json();
      if (!response.ok || !data.content) throw new Error(data.error || `Service returned ${response.status}`);
      setAiSummaryText(`[${data.engine}${data.model ? ` · ${data.model}` : ''}]\n${data.content}`);
    } catch (error) {
      setAiSummaryText(`${aiMode === 'nvidia' ? 'NVIDIA hosted AI' : 'Local AI'} unavailable: ${error.message}. No AI output was generated. Select Offline Local Mode to use the deterministic template.`);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Deterministic local clinical summary (100% offline, zero network)
  const generateDeterministicSummary = (report) => {
    const painList = (report.painRegions || []).map(p => 
      `${p.name} (${p.side || 'Bilateral'}): Severity ${p.intensity}/10 [${p.painType || 'Aching'}, ${p.onset || 'Onset unspec'}]`
    ).join('; ');

    const islList = (report.islStatements || []).map(s => `"${s.confirmedText}"`).join('; ');

    return `[LOCAL DETERMINISTIC SUMMARY - INFORMATIONAL ONLY - NOT A MEDICAL DIAGNOSIS]
• Patient Identifier: ${report.patientId || 'Unspecified'} | Primary Mode: ${report.preferredLanguage || 'ISL'}
• ISL Accommodations: ${report.needsInterpreter ? 'Qualified Interpreter Requested' : 'Standard Accessibility'}
• Patient-Confirmed ISL Statements: ${islList || 'None submitted'}
• Pain & Symptom Locations: ${painList || 'No pain areas reported'}
• Patient Questions for Doctor: ${report.patientQuestions || 'None provided'}
• Verification Status: ${report.confirmedByPatient ? 'Explicitly Confirmed by Patient' : 'Unconfirmed Draft'}
• Clinical Notice: Clinician assessment and validation required before any therapeutic decisions.`;
  };

  const getIntensityColor = (intensity) => {
    if (intensity <= 2) return '#10b981';
    if (intensity <= 5) return '#f59e0b';
    if (intensity <= 8) return '#f97316';
    return '#ef4444';
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="doctor-dashboard-layout printable-area" aria-label="Doctor Clinical Desk">
      {/* Top Bar for Clinician */}
      <div className="doctor-top-bar no-print">
        <div className="dr-top-left">
          <Stethoscope size={22} className="dr-title-icon" />
          <div>
            <h3>Doctor Clinical Communication Desk</h3>
            <span className="dr-subtext">
              Reviewing Confirmed Patient Communication Reports · Local Hospital LAN Connected
            </span>
          </div>
        </div>

        <div className="dr-top-actions">
          <button type="button" className="secondary-btn" onClick={handlePrint}>
            <Printer size={15} /> Print / Export Consultation
          </button>
          {activeReport && activeReport.status !== 'completed' && (
            <button type="button" className="primary-btn complete-btn" onClick={handleCompleteConsultation}>
              <CheckCircle size={16} /> Mark Consultation Completed
            </button>
          )}
        </div>
      </div>

      <div className="doctor-main-split">
        {/* Left Column: Report Navigation List */}
        <div className="reports-sidebar no-print">
          <div className="sidebar-list-header">
            <h4>Incoming Reports ({reports.length})</h4>
          </div>

          {reports.length === 0 ? (
            <div className="empty-reports-sidebar">
              <FileText size={26} className="muted-icon" />
              <p>No confirmed patient reports received yet.</p>
              <small>Reports sent from the Patient dashboard on this device or the local network will appear here.</small>
            </div>
          ) : (
            <div className="report-items-stack">
              {reports.map((rep) => (
                <div 
                  key={rep.id} 
                  className={`report-nav-card ${activeReport?.id === rep.id ? 'active-card' : ''}`}
                  onClick={() => onSelectReport(rep.id)}
                  role="button"
                  tabIndex="0"
                >
                  <div className="rep-card-top">
                    <b>{rep.patientId || 'Patient'}</b>
                    <span className={`status-pill ${rep.status === 'completed' ? 'done' : 'new'}`}>
                      {rep.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}
                    </span>
                  </div>
                  <div className="rep-card-info">
                    <span><Clock size={11} /> {new Date(rep.createdAt || Date.now()).toLocaleTimeString()}</span>
                    <span>{rep.painRegions?.length || 0} Pain Area(s)</span>
                  </div>
                  {rep.islStatements && rep.islStatements.length > 0 && (
                    <div className="rep-card-snippet">
                      "{rep.islStatements[0].confirmedText.substring(0, 38)}..."
                    </div>
                  )}
                  {rep.transferMode && (
                    <div className="transfer-source-tag">
                      Via: {rep.transferMode}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Full 12-Section Active Report View */}
        {!activeReport ? (
          <div className="no-active-report-pane">
            <Stethoscope size={48} className="muted-icon" />
            <h4>Select a Patient Report</h4>
            <p>Choose an incoming patient report from the left sidebar to inspect details, review the pain map, and record clinician notes.</p>
          </div>
        ) : (
          <div className="active-report-full-view">
            {/* Report Header Card */}
            <div className="report-banner-card">
              <div className="banner-left">
                <span className="banner-id">{activeReport.patientId || 'PT-LOCAL'}</span>
                <h2>Patient Clinical Consultation Summary</h2>
                <div className="banner-meta-row">
                  <span>Received: <strong>{new Date(activeReport.createdAt || Date.now()).toLocaleString()}</strong></span>
                  <span>Sync Status: <strong>{activeReport.deliveryAcknowledged ? 'Genuine Server Acknowledged' : 'Local Device DB'}</strong></span>
                  <span>Patient Confirmed: <strong className="green-text">Yes (Patient Verified)</strong></span>
                </div>
              </div>
              <div className="banner-right">
                <span className={`consult-status-badge ${activeReport.status === 'completed' ? 'completed' : 'in-review'}`}>
                  {activeReport.status === 'completed' ? 'CONSULTATION COMPLETED' : 'UNDER CLINICIAN REVIEW'}
                </span>
              </div>
            </div>

            {/* SECTION 1: Patient Communication Profile */}
            <div className="doc-section-card">
              <div className="doc-section-header">
                <div className="sec-title-group">
                  <User size={18} className="sec-icon" />
                  <h4>1. Patient Communication Profile & Accessibility Needs</h4>
                </div>
                <label className="review-checkbox">
                  <input 
                    type="checkbox" 
                    checked={reviewedSections.profile} 
                    onChange={() => toggleSectionReviewed('profile')}
                  />
                  <span>Mark Reviewed</span>
                </label>
              </div>

              <div className="doc-profile-grid">
                <div className="dr-field">
                  <small>Patient Identifier</small>
                  <b>{activeReport.patientId || 'Unspecified'}</b>
                </div>
                <div className="dr-field">
                  <small>Primary Language</small>
                  <b>{activeReport.preferredLanguage || 'Indian Sign Language (ISL)'}</b>
                </div>
                <div className="dr-field">
                  <small>Qualified ISL Interpreter Required</small>
                  <b className={activeReport.needsInterpreter ? 'red-bold' : ''}>
                    {activeReport.needsInterpreter ? 'YES — In-Person or VRI Qualified Support' : 'No'}
                  </b>
                </div>
                <div className="dr-field">
                  <small>Patient Confirmation Status</small>
                  <b>Confirmed by Patient before transfer</b>
                </div>
              </div>
            </div>

            {/* SECTION 2 & 3: Patient-Confirmed ISL Interpretation & Breakdown */}
            <div className="doc-section-card">
              <div className="doc-section-header">
                <div className="sec-title-group">
                  <Languages size={18} className="sec-icon" />
                  <h4>2 & 3. Confirmed ISL Interpretation & Recognition Audit Trail</h4>
                </div>
                <label className="review-checkbox">
                  <input 
                    type="checkbox" 
                    checked={reviewedSections.isl} 
                    onChange={() => toggleSectionReviewed('isl')}
                  />
                  <span>Mark Reviewed</span>
                </label>
              </div>

              {(!activeReport.islStatements || activeReport.islStatements.length === 0) ? (
                <p className="dr-empty-text">No camera sign language statements submitted.</p>
              ) : (
                <div className="dr-isl-statements">
                  {activeReport.islStatements.map((stmt, idx) => (
                    <div key={idx} className="dr-statement-box">
                      <div className="dr-statement-quote">
                        <span className="quote-mark">“</span>
                        <b>{stmt.confirmedText}</b>
                        <span className="quote-mark">”</span>
                      </div>
                      
                      <div className="dr-audit-row">
                        <span className="audit-tag pt-confirmed">Patient Confirmed</span>
                        {stmt.wasManuallyEdited && (
                          <span className="audit-tag pt-edited">Edited by Patient</span>
                        )}
                        <span className="audit-meta">
                          Timestamp: {stmt.confirmedAt ? new Date(stmt.confirmedAt).toLocaleTimeString() : 'N/A'}
                        </span>
                        <span className="audit-meta">
                          Model: {stmt.modelInfo || 'Continuous ISL Sequence GRU'}
                        </span>
                      </div>

                      {stmt.rawTokens && stmt.rawTokens.length > 0 && (
                        <div className="dr-tokens-breakdown">
                          <small>Tokens Audit (AI predictions vs Patient Corrections):</small>
                          <div className="dr-token-chips">
                            {stmt.rawTokens.map((t, tIdx) => (
                              <span 
                                key={tIdx} 
                                className={`dr-chip ${t.isUnknown ? 'dr-chip-unknown' : ''} ${t.isManual ? 'dr-chip-manual' : ''}`}
                              >
                                {t.text} {t.confidence ? `(${t.confidence}%)` : ''} - {t.isManual ? 'Manual' : 'AI'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 4 & 5: Visual Pain Map & Characteristic Table */}
            <div className="doc-section-card">
              <div className="doc-section-header">
                <div className="sec-title-group">
                  <AlertTriangle size={18} className="sec-icon" />
                  <h4>4 & 5. Anatomy Pain Map & Symptoms Details</h4>
                </div>
                <label className="review-checkbox">
                  <input 
                    type="checkbox" 
                    checked={reviewedSections.pain} 
                    onChange={() => toggleSectionReviewed('pain')}
                  />
                  <span>Mark Reviewed</span>
                </label>
              </div>

              {(!activeReport.painRegions || activeReport.painRegions.length === 0) ? (
                <p className="dr-empty-text">No painful regions indicated on the anatomy diagram.</p>
              ) : (
                <div className="dr-pain-grid">
                  {/* Visual Silhouette Mini-Map with Front/Back Toggle */}
                  <div className="dr-pain-mini-visual">
                    <div className="mini-view-toggle">
                      <button 
                        type="button" 
                        className={`mini-tab ${activePainTab === 'front' ? 'active' : ''}`}
                        onClick={() => setActivePainTab('front')}
                      >
                        Front View
                      </button>
                      <button 
                        type="button" 
                        className={`mini-tab ${activePainTab === 'back' ? 'active' : ''}`}
                        onClick={() => setActivePainTab('back')}
                      >
                        Back View
                      </button>
                    </div>

                    <div className="dr-mini-svg-stage">
                      <svg viewBox="0 0 320 540" className="dr-anatomy-svg">
                        <g opacity="0.12" fill="#182b31">
                          <ellipse cx="160" cy="45" rx="32" ry="40" />
                          <rect x="148" y="82" width="24" height="24" rx="4" />
                          <path d="M 112 106 L 208 106 L 200 240 L 120 240 Z" />
                          <path d="M 120 240 L 200 240 L 206 280 L 114 280 Z" />
                          <path d="M 122 280 L 154 280 L 148 400 L 122 400 Z" />
                          <path d="M 166 280 L 198 280 L 198 400 L 172 400 Z" />
                        </g>

                        {/* Highlighted active regions on mini map */}
                        {activeReport.painRegions.map(p => {
                          return (
                            <circle 
                              key={p.id}
                              cx={p.id.includes('head') ? 160 : p.id.includes('chest') ? 160 : p.id.includes('abdomen') ? 160 : p.id.includes('knee') ? 150 : 160}
                              cy={p.id.includes('head') ? 45 : p.id.includes('chest') ? 140 : p.id.includes('abdomen') ? 200 : p.id.includes('knee') ? 392 : 240}
                              r="18"
                              fill={getIntensityColor(p.intensity)}
                              opacity="0.85"
                              stroke="#ffffff"
                              strokeWidth="2"
                            />
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  {/* Pain Characteristics Table */}
                  <div className="dr-pain-table-wrapper">
                    <table className="dr-table">
                      <thead>
                        <tr>
                          <th>Region</th>
                          <th>Side</th>
                          <th>Intensity</th>
                          <th>Type</th>
                          <th>Onset</th>
                          <th>Pattern</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeReport.painRegions.map((region) => (
                          <tr key={region.id}>
                            <td><b>{region.name}</b></td>
                            <td>{region.side || 'Central'}</td>
                            <td>
                              <span 
                                className="dr-severity-chip"
                                style={{ background: getIntensityColor(region.intensity) }}
                              >
                                {region.intensity} / 10
                              </span>
                            </td>
                            <td>{region.painType || 'Aching'}</td>
                            <td>{region.onset || 'Unspecified'}</td>
                            <td>{region.pattern || 'Constant'}</td>
                            <td>{region.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 6 & 7: Conversation History & Doctor Speech Recognition */}
            <div className="doc-section-card no-print">
              <div className="doc-section-header">
                <div className="sec-title-group">
                  <MessageSquare size={18} className="sec-icon" />
                  <h4>6 & 7. Clinician Speech Response & Session Messages</h4>
                </div>
              </div>

              {/* Doctor Speech Recognition Box */}
              <div className="dr-speech-box">
                <div className="speech-controls-row">
                  <button 
                    type="button" 
                    className={`dr-mic-btn ${isListening ? 'listening' : ''}`}
                    onClick={isListening ? stopSpeech : startSpeech}
                  >
                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    {isListening ? 'Stop Speaking' : 'Speak Message (Speech-to-Text)'}
                  </button>
                  <small className="speech-subtext">English (India) · Reviewed transcript appears below before sending.</small>
                </div>

                <div className="dr-speech-textarea-wrap">
                  <textarea 
                    rows={3}
                    placeholder="Doctor spoken or typed response to patient..."
                    value={clarificationInput || doctorSpeechText}
                    onChange={(e) => {
                      setClarificationInput(e.target.value);
                      setDoctorSpeechText(e.target.value);
                    }}
                    className="dr-input-textarea"
                  />
                  <div className="speech-actions-row">
                    <button 
                      type="button" 
                      className="secondary-btn"
                      onClick={() => {
                        const txt = (clarificationInput || doctorSpeechText).trim();
                        if (txt && 'speechSynthesis' in window) {
                          window.speechSynthesis.speak(new SpeechSynthesisUtterance(txt));
                        }
                      }}
                    >
                      <Volume2 size={14} /> Preview Audio
                    </button>
                    <button 
                      type="button" 
                      className="primary-btn" 
                      onClick={sendClarificationMessage}
                      disabled={!clarificationInput.trim() && !doctorSpeechText.trim()}
                    >
                      <Send size={14} /> Send Message to Patient
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 8, 9, 10: Accommodations, Checklist & Questions */}
            <div className="doc-section-card">
              <div className="doc-section-header">
                <div className="sec-title-group">
                  <FileCheck size={18} className="sec-icon" />
                  <h4>8, 9 & 10. Accommodations, Preparation & Patient Questions</h4>
                </div>
                <label className="review-checkbox">
                  <input 
                    type="checkbox" 
                    checked={reviewedSections.questions} 
                    onChange={() => toggleSectionReviewed('questions')}
                  />
                  <span>Mark Reviewed</span>
                </label>
              </div>

              <div className="doc-tri-grid">
                <div className="doc-card-subblock">
                  <b>8. Accessibility Accommodations</b>
                  <ul className="subblock-list">
                    <li>ISL Interpreter: <strong>{activeReport.needsInterpreter ? 'Required' : 'None'}</strong></li>
                    <li>Visual Support: <strong>Communication Cards & Diagrams Active</strong></li>
                    <li>Audio Playback for Patient: <strong>Available on Device</strong></li>
                  </ul>
                </div>

                <div className="doc-card-subblock">
                  <b>9. Preparation Checklist</b>
                  <p>{activeReport.preparationNotes || 'No special mobility or preparation requirements recorded.'}</p>
                </div>

                <div className="doc-card-subblock">
                  <b>10. Patient Questions for Clinician</b>
                  <p className="dr-question-highlight">
                    {activeReport.patientQuestions || 'Patient did not enter specific questions.'}
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 11: AI-Generated Structured Summary */}
            <div className="doc-section-card ai-summary-card">
              <div className="doc-section-header">
                <div className="sec-title-group">
                  <Sparkles size={18} className="sec-icon purple-icon" />
                  <h4>11. Clinical Communication Summary (Deterministic / Local AI)</h4>
                  <span className="ai-mode-pill">Active: {aiMode.toUpperCase()} MODE</span>
                </div>
                <label className="review-checkbox">
                  <input 
                    type="checkbox" 
                    checked={reviewedSections.aiSummary} 
                    onChange={() => toggleSectionReviewed('aiSummary')}
                  />
                  <span>Mark Reviewed</span>
                </label>
              </div>

              <div className="dr-ai-summary-content">
                {isSummarizing ? (
                  <div className="summary-loading">
                    <RefreshCw size={16} className="spin" /> Generating clinical summary...
                  </div>
                ) : (
                  <pre className="dr-summary-pre">{aiSummaryText}</pre>
                )}
                <div className="dr-ai-disclaimer">
                  <AlertCircle size={13} />
                  <span>
                    Summary synthesized from confirmed patient inputs. This is not a diagnosis or clinical recommendation. A medical professional must independently verify all findings.
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 12: Clinician Notes & Consultation Closure */}
            <div className="doc-section-card clinician-notes-card">
              <div className="doc-section-header">
                <div className="sec-title-group">
                  <Stethoscope size={18} className="sec-icon teal-icon" />
                  <h4>12. Clinician Consultation Notes & Assessment</h4>
                </div>
                <button type="button" className="primary-btn save-notes-btn" onClick={saveClinicianNotes}>
                  <Check size={14} /> Save Clinician Notes
                </button>
              </div>

              <div className="clinician-notes-editor">
                <textarea 
                  rows={4}
                  placeholder="Enter medical doctor examination notes, assessment, follow-up recommendations, or interpreter arrangement notes..."
                  value={clinicianNotes}
                  onChange={(e) => setClinicianNotes(e.target.value)}
                  className="clinician-notes-textarea"
                />
                <div className="notes-meta-footer">
                  <small>Clinician notes are strictly isolated and marked distinct from patient statements and AI summaries.</small>
                  {activeReport.clinicianReviewedAt && (
                    <span className="reviewed-timestamp">
                      Last Saved: {new Date(activeReport.clinicianReviewedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

