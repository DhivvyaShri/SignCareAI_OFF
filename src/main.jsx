import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Activity, 
  AlertTriangle,
  AudioLines, 
  Camera, 
  Check, 
  ChevronRight, 
  CircleHelp, 
  ClipboardList, 
  FolderSync,
  Hand, 
  HeartPulse, 
  Languages, 
  MessageCircle, 
  Mic, 
  MicOff, 
  RotateCcw,
  Send, 
  ShieldCheck, 
  Sparkles,
  Square, 
  Stethoscope, 
  User,
  Volume2, 
  Video, 
  X 
} from 'lucide-react';

import './styles.css';
import { 
  getAllMessages, 
  getAllReports, 
  getPendingSyncQueue, 
  queueForSync, 
  saveMessage, 
  saveReport 
} from './utils/db';
import BodyPainMap from './components/BodyPainMap';
import ContinuousISLRecognition from './components/ContinuousISLRecognition';
import PatientReportModal from './components/PatientReportModal';
import DoctorDashboard from './components/DoctorDashboard';
import LocalSyncManager from './components/LocalSyncManager';
import AIAssistantConfig from './components/AIAssistantConfig';

// Configurable local or hospital backend URL
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

// Preserved original authentic hospital communication prompt cards
const signs = [
  { word: 'Help', emoji: '🆘', group: 'Urgent', detail: 'I need immediate assistance. Alert hospital staff directly if critical.' },
  { word: 'Breathing difficulty', emoji: '🫁', group: 'Urgent', detail: 'I am having trouble breathing. Alert clinical emergency staff immediately.' },
  { word: 'Bleeding', emoji: '🩹', group: 'Urgent', detail: 'I am bleeding. Alert nursing staff.' },
  { word: 'Severe pain', emoji: '⚠️', group: 'Urgent', detail: 'I have severe pain. Indicate affected body area on pain diagram.' },
  { word: 'Pain', emoji: '🤕', group: 'Symptoms', detail: 'I have pain. Please help me indicate the affected region.' },
  { word: 'Fever', emoji: '🌡️', group: 'Symptoms', detail: 'I feel warm or have chills. Clinical temperature assessment needed.' },
  { word: 'Dizzy', emoji: '😵‍💫', group: 'Symptoms', detail: 'I feel dizzy or lightheaded. Please assist me to sit safely.' },
  { word: 'Nausea', emoji: '🤢', group: 'Symptoms', detail: 'I feel nauseated or sick to my stomach.' },
  { word: 'I feel cold', emoji: '🥶', group: 'Symptoms', detail: 'I feel cold or request an additional blanket.' },
  { word: 'Doctor', emoji: '🩺', group: 'People', detail: 'I would like to speak with a physician or doctor.' },
  { word: 'Nurse', emoji: '👩‍⚕️', group: 'People', detail: 'I would like to speak with a nurse.' },
  { word: 'Call my family', emoji: '📞', group: 'People', detail: 'Please assist in contacting my family member or caregiver.' },
  { word: 'Water', emoji: '💧', group: 'Needs', detail: 'I need water. Staff should verify if oral fluid intake is allowed.' },
  { word: 'Food', emoji: '🍲', group: 'Needs', detail: 'I request food. Staff should check any fasting or dietary restrictions.' },
  { word: 'Toilet', emoji: '🚻', group: 'Needs', detail: 'I need to use the washroom or bedpan. Assistance requested.' },
  { word: 'Wheelchair', emoji: '♿', group: 'Needs', detail: 'I need mobility or wheelchair assistance.' },
  { word: 'Medicine', emoji: '💊', group: 'Needs', detail: 'I have a question regarding my medication.' },
  { word: 'Need rest', emoji: '🛏️', group: 'Needs', detail: 'I feel fatigued and need to rest.' },
  { word: 'Yes', emoji: '👍', group: 'Responses', detail: 'Yes. Confirm specific meaning.' },
  { word: 'No', emoji: '👎', group: 'Responses', detail: 'No. Confirm specific meaning.' },
  { word: 'I do not understand', emoji: '❓', group: 'Responses', detail: 'Please explain again or arrange qualified ISL interpreter support.' },
  { word: 'Thank you', emoji: '🙏', group: 'Responses', detail: 'Thank you for your assistance.' },
];

function App() {
  const [role, setRole] = useState('patient'); // 'patient' | 'doctor'
  const [activeTab, setActiveTab] = useState('communication'); // 'communication' | 'sync' | 'ai-settings'

  // Patient states
  const [patientId] = useState(`PT-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [confirmedISLStatements, setConfirmedISLStatements] = useState([]);
  const [selectedPainRegions, setSelectedPainRegions] = useState([]);
  const [manualFallbackText, setManualFallbackText] = useState('');
  const [patientQuestions, setPatientQuestions] = useState('');
  const [preparationNotes, setPreparationNotes] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [filter, setFilter] = useState('All');

  // Doctor speech-to-text states
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [doctorSpeechText, setDoctorSpeechText] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);

  // Reports & Transfer Management
  const [savedReports, setSavedReports] = useState([]);
  const [activeDoctorReportId, setActiveDoctorReportId] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [transferMode, setTransferMode] = useState('modeA'); // 'modeA' = Same-device IndexedDB, 'modeB' = Shared Hospital LAN
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [aiMode, setAiMode] = useState('offline'); // 'offline' | 'ollama' | 'nvidia' | 'disabled'

  const recognitionRef = useRef(null);

  // Initialize offline IndexedDB reports and speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));

    refreshReportsFromDB();
    loadMessagesFromDB();
  }, []);

  const refreshReportsFromDB = async () => {
    try {
      const reports = await getAllReports();
      setSavedReports(reports);
      if (reports.length > 0 && !activeDoctorReportId) {
        setActiveDoctorReportId(reports[0].id);
      }
    } catch (e) {
      console.warn('Could not read reports from IndexedDB:', e);
    }
  };

  const loadMessagesFromDB = async () => {
    try {
      const msgs = await getAllMessages();
      setConversationHistory(msgs);
    } catch (e) {
      console.warn('Could not read messages:', e);
    }
  };

  // Add confirmed ISL sentence from continuous recognition console
  const handleConfirmISLSentence = (sentenceData) => {
    setConfirmedISLStatements(prev => [...prev, sentenceData]);
    // Also save in session conversation history
    const messageRecord = {
      from: 'Patient (ISL Confirmed)',
      text: sentenceData.confirmedText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: sentenceData.modelInfo
    };
    saveMessage(messageRecord);
    setConversationHistory(prev => [...prev, messageRecord]);
  };

  // Build structured patient communication report object
  const constructCurrentReport = () => {
    return {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      patientId,
      createdAt: new Date().toISOString(),
      status: 'confirmed', // 'draft' | 'confirmed' | 'completed'
      confirmedByPatient: true,
      preferredLanguage: 'Indian Sign Language (ISL)',
      needsInterpreter: true,
      islStatements: [...confirmedISLStatements],
      painRegions: [...selectedPainRegions],
      typedMessages: [...conversationHistory],
      patientQuestions,
      preparationNotes,
      transferMode: transferMode === 'modeA' ? 'Same-Device IndexedDB' : 'Shared Hospital LAN',
      deliveryAcknowledged: false
    };
  };

  // Save Report Offline in IndexedDB
  const handleSaveReportOffline = async () => {
    const report = constructCurrentReport();
    await saveReport(report);
    await refreshReportsFromDB();
    alert(`Report ${report.patientId} saved offline in local IndexedDB. Accessible immediately in Doctor view.`);
  };

  // Send Report to Doctor (Mode A or Mode B)
  const handleSendReportToDoctor = async () => {
    setIsSendingReport(true);
    const report = constructCurrentReport();

    try {
      if (transferMode === 'modeA') {
        // Mode A: Same Device Demonstration (IndexedDB)
        report.deliveryAcknowledged = true;
        report.deliveryMethod = 'Local Device IndexedDB Shared Store';
        await saveReport(report);
        await refreshReportsFromDB();
        setIsSendingReport(false);
        setIsReportModalOpen(false);
        alert(`Report transmitted to local Doctor Dashboard (Mode A). Click "Doctor Dashboard" in the sidebar to review.`);
      } else {
        // Mode B: Shared Local Hospital Network via Flask backend
        report.deliveryMethod = 'Shared Local Hospital Network (LAN)';
        try {
          const res = await fetch(`${API_BASE_URL}/api/reports`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer LOCAL_HOSPITAL_SECRET_2026'
            },
            body: JSON.stringify(report)
          });

          if (res.ok) {
            const data = await res.json();
            report.deliveryAcknowledged = true;
            report.serverReportId = data.reportId;
            report.serverAcknowledgment = data.acknowledgment;
            await saveReport(report);
            await refreshReportsFromDB();
            setIsSendingReport(false);
            setIsReportModalOpen(false);
            alert(`Report confirmed and transferred to Hospital Server at ${API_BASE_URL}. Server ID: ${data.reportId}`);
          } else {
            throw new Error(`Server returned status ${res.status}`);
          }
        } catch (netErr) {
          // If server offline, queue in IndexedDB sync queue
          await queueForSync(report);
          await saveReport(report);
          await refreshReportsFromDB();
          setIsSendingReport(false);
          setIsReportModalOpen(false);
          alert(`Hospital server unreachable at ${API_BASE_URL}. Report preserved in local IndexedDB and queued for sync.`);
        }
      }
    } catch (err) {
      setIsSendingReport(false);
      alert(`Transfer error: ${err.message}`);
    }
  };

  // Update Doctor Review status
  const handleUpdateDoctorReview = async (reportId, updates) => {
    const existing = savedReports.find(r => r.id === reportId);
    if (!existing) return;
    const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await saveReport(merged);
    await refreshReportsFromDB();
  };

  // Send Clarification Message from Doctor to Patient
  const handleDoctorClarification = async ({ reportId, text, time }) => {
    const msg = {
      from: 'Doctor',
      text,
      time,
      reportId
    };
    await saveMessage(msg);
    setConversationHistory(prev => [...prev, msg]);
    
    // Audio playback for patient
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  };

  // Speech-to-Text Recognition for Doctor
  const startDoctorSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setDoctorSpeechText(transcript.trim());
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const stopDoctorSpeech = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const visibleSigns = signs.filter(s => filter === 'All' || s.group === filter);

  return (
    <div className="app-shell">
      {/* Accessible Sidebar Navigation */}
      <aside className="sidebar no-print">
        <div className="brand">
          <div className="brand-icon">
            <Hand size={24} />
          </div>
          <div>
            <b>SignCare <span>AI</span></b>
            <small>OFFLINE ISL HOSPITAL SYSTEM</small>
          </div>
        </div>

        <div className="nav-label">WORKSPACES</div>
        <button 
          className={`nav-item ${role === 'patient' ? 'active' : ''}`}
          onClick={() => setRole('patient')}
        >
          <HeartPulse size={18} /> Patient Dashboard
        </button>

        <button 
          className={`nav-item ${role === 'doctor' ? 'active' : ''}`}
          onClick={() => setRole('doctor')}
        >
          <Stethoscope size={18} /> Doctor Dashboard
        </button>

        <div className="nav-label" style={{ marginTop: '16px' }}>SYSTEM TOOLS</div>
        <button 
          className={`nav-item ${activeTab === 'sync' ? 'active' : ''}`}
          onClick={() => setActiveTab(activeTab === 'sync' ? 'communication' : 'sync')}
        >
          <FolderSync size={18} /> Offline Storage & Sync
        </button>

        <button 
          className={`nav-item ${activeTab === 'ai-settings' ? 'active' : ''}`}
          onClick={() => setActiveTab(activeTab === 'ai-settings' ? 'communication' : 'ai-settings')}
        >
          <Sparkles size={18} /> AI Mode Configuration
        </button>

        {/* Clinical Safe Practice Card */}
        <div className="side-card">
          <div className="side-shield">
            <ShieldCheck size={18} />
          </div>
          <b>Air-Gapped & Accessible</b>
          <p>Operates 100% offline without remote CDNs or cloud APIs. Zero patient video leaves your computer.</p>
        </div>

        <div className="sidebar-bottom">
          <span className="status-dot" /> Offline Service Worker Active
          <small>SignCare AI v2.0 · Local IndexedDB</small>
        </div>
      </aside>

      {/* Main Workspace Layout */}
      <main className="main-content">
        {/* Top Header Bar */}
        <header className="topbar no-print">
          <div>
            <div className="eyebrow">ACCESSIBLE HEALTHCARE PLATFORM</div>
            <h1>{role === 'patient' ? 'Patient Communication Portal' : 'Doctor Clinical Consultation Desk'}</h1>
          </div>

          <div className="top-actions">
            <span className="secure-pill">
              <ShieldCheck size={14} /> 100% Local Confidential Session
            </span>
            <div className="avatar">
              {role === 'patient' ? 'PT' : 'DR'}
            </div>
          </div>
        </header>

        {/* Global Emergency Safety Notice */}
        <div className="notice no-print">
          <AlertTriangle size={18} style={{ color: '#b45309' }} />
          <div>
            <b>Healthcare Accessibility Notice</b>
            <span>
              SignCare AI provides communication support for Deaf and hard-of-hearing individuals. It does not replace certified ISL medical interpreters and does not provide clinical diagnosis. In case of acute chest pain, severe breathlessness, or trauma, alert hospital staff immediately.
            </span>
          </div>
        </div>

        {/* Tool Drawers: Sync Manager or AI Engine Settings */}
        {activeTab === 'sync' && (
          <div className="no-print">
            <LocalSyncManager 
              apiBaseUrl={API_BASE_URL}
              transferMode={transferMode}
              setTransferMode={setTransferMode}
              onRefreshReports={refreshReportsFromDB}
            />
          </div>
        )}

        {activeTab === 'ai-settings' && (
          <div className="no-print">
            <AIAssistantConfig 
              aiMode={aiMode}
              setAiMode={setAiMode}
            />
          </div>
        )}

        {/* PATIENT VIEW */}
        {role === 'patient' ? (
          <>
            <section className="welcome-row no-print">
              <div>
                <h2>Hello! How can we assist your care today?</h2>
                <p>Use the continuous ISL camera, mark your pain locations on the body map, or pick quick cards.</p>
              </div>
              <div className="patient-tag">
                <span className="status-dot" /> Patient ID: {patientId}
              </div>
            </section>

            {/* 1. Continuous ISL Camera Recognition Console */}
            <ContinuousISLRecognition 
              apiBaseUrl={API_BASE_URL}
              onConfirmSentence={handleConfirmISLSentence}
              manualFallbackText={manualFallbackText}
              setManualFallbackText={setManualFallbackText}
            />

            {/* 2. Interactive Human Anatomy Pain Map */}
            <BodyPainMap 
              selectedPainRegions={selectedPainRegions}
              onChange={setSelectedPainRegions}
            />

            {/* 3. Quick Communication Cards */}
            <section className="panel signs-panel no-print">
              <div className="panel-heading signs-heading">
                <div className="heading-icon orange">
                  <Languages size={18} />
                </div>
                <div>
                  <h3>Hospital Communication Cards</h3>
                  <p>Select cards to add common medical needs or responses to your session.</p>
                </div>
              </div>

              <div className="filters">
                {['All', 'Urgent', 'Symptoms', 'Responses', 'People', 'Needs'].map(f => (
                  <button 
                    key={f} 
                    className={`filter-chip ${filter === f ? 'chosen' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="sign-grid">
                {visibleSigns.map(sign => (
                  <button 
                    key={sign.word}
                    className={`sign-card ${selectedCard?.word === sign.word ? 'sign-selected' : ''}`}
                    onClick={() => {
                      setSelectedCard(sign);
                      const msgRecord = {
                        from: 'Patient (Quick Card)',
                        text: `${sign.word}: ${sign.detail}`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      };
                      saveMessage(msgRecord);
                      setConversationHistory(prev => [...prev, msgRecord]);
                    }}
                  >
                    <span className="sign-emoji">{sign.emoji}</span>
                    <b>{sign.word}</b>
                    <span className="sign-card-caption">{sign.group}</span>
                    <ChevronRight className="sign-arrow" size={16} />
                  </button>
                ))}
              </div>
            </section>

            {/* 4. Complete Patient Communication Report Action Banner */}
            <section className="panel report-action-banner no-print">
              <div className="report-action-content">
                <div className="report-action-icon">
                  <ClipboardList size={28} />
                </div>
                <div>
                  <h3>Complete Patient Medical Communication Report</h3>
                  <p>
                    {confirmedISLStatements.length} Confirmed ISL Statement(s) · {selectedPainRegions.length} Pain Area(s) Marked
                  </p>
                  <small>Review, verify, export to PDF, or securely dispatch your report to the doctor.</small>
                </div>
              </div>

              <button 
                type="button" 
                className="primary-btn review-report-btn"
                onClick={() => setIsReportModalOpen(true)}
              >
                <ClipboardList size={16} /> Review & Send Report to Doctor
              </button>
            </section>

            {/* Structured Report Modal Dialog */}
            <PatientReportModal 
              isOpen={isReportModalOpen}
              onClose={() => setIsReportModalOpen(false)}
              reportData={constructCurrentReport()}
              onUpdateReport={(updated) => {
                if (updated.islStatements) setConfirmedISLStatements(updated.islStatements);
                if (updated.painRegions) setSelectedPainRegions(updated.painRegions);
                if (updated.patientQuestions) setPatientQuestions(updated.patientQuestions);
                if (updated.preparationNotes) setPreparationNotes(updated.preparationNotes);
              }}
              onSaveOffline={handleSaveReportOffline}
              onSendToDoctor={handleSendReportToDoctor}
              isSending={isSendingReport}
            />
          </>
        ) : (
          /* DOCTOR DASHBOARD VIEW */
          <DoctorDashboard 
            apiBaseUrl={API_BASE_URL}
            reports={savedReports}
            activeReportId={activeDoctorReportId}
            onSelectReport={setActiveDoctorReportId}
            onUpdateReportReview={handleUpdateDoctorReview}
            onSendClarification={handleDoctorClarification}
            doctorSpeechText={doctorSpeechText}
            setDoctorSpeechText={setDoctorSpeechText}
            isListening={isListening}
            startSpeech={startDoctorSpeech}
            stopSpeech={stopDoctorSpeech}
            speechSupported={speechSupported}
            aiMode={aiMode}
          />
        )}

        {/* Global Footer */}
        <footer className="no-print">
          SignCare AI · Offline-First Indian Sign Language (ISL) Hospital Communication Platform
          <span>Not a clinical diagnostic device. Confirm all machine interpretations.</span>
        </footer>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
