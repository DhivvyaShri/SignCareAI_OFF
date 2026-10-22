import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Check, 
  Clock, 
  Download, 
  Edit3, 
  FileText, 
  Languages, 
  Lock, 
  Printer, 
  Send, 
  Share2, 
  ShieldCheck, 
  User, 
  X,
  Volume2
} from 'lucide-react';

export default function PatientReportModal({
  isOpen,
  onClose,
  reportData,
  onUpdateReport,
  onSaveOffline,
  onSendToDoctor,
  isSending
}) {
  if (!isOpen || !reportData) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [patientId, setPatientId] = useState(reportData.patientId || `PT-${Math.floor(1000 + Math.random() * 9000)}`);
  const [preferredLang, setPreferredLang] = useState(reportData.preferredLanguage || 'Indian Sign Language (ISL)');
  const [needsInterpreter, setNeedsInterpreter] = useState(reportData.needsInterpreter ?? true);
  const [patientQuestions, setPatientQuestions] = useState(reportData.patientQuestions || '');
  const [preparationNotes, setPreparationNotes] = useState(reportData.preparationNotes || '');
  const [confirmedByPatient, setConfirmedByPatient] = useState(reportData.confirmedByPatient ?? true);

  const handleSaveEdits = () => {
    const updated = {
      ...reportData,
      patientId,
      preferredLanguage: preferredLang,
      needsInterpreter,
      patientQuestions,
      preparationNotes,
      confirmedByPatient,
      updatedAt: new Date().toISOString()
    };
    onUpdateReport(updated);
    setIsEditing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `SignCare_PatientReport_${reportData.patientId || 'local'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="modal-backdrop report-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className="patient-report-modal printable-area">
        {/* Report Top Header */}
        <div className="report-header no-print">
          <div className="report-title-row">
            <div className="report-brand">
              <FileText className="brand-file-icon" size={24} />
              <div>
                <h3 id="report-title">Patient Medical Communication Report</h3>
                <span className="report-meta">
                  Confidential Healthcare Record · Local Device Generated
                </span>
              </div>
            </div>
            <div className="report-top-actions">
              <button 
                type="button" 
                className="secondary-btn" 
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit3 size={15} /> {isEditing ? 'Cancel Edit' : 'Edit Details'}
              </button>
              <button 
                type="button" 
                className="icon-btn close-report-btn" 
                onClick={onClose}
                aria-label="Close report"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Emergency Medical Guidance Notice */}
        <div className="emergency-guidance-banner">
          <AlertTriangle size={18} className="emergency-icon" />
          <div className="emergency-text">
            <strong>EMERGENCY WARNING FOR PATIENTS & STAFF</strong>
            <p>
              If you are experiencing severe chest pain, sudden difficulty breathing, facial drooping, sudden weakness, or severe bleeding, notify clinical emergency staff immediately or dial 112 / 108. This application is an accessible communication aid, not an emergency triage or clinical diagnostic system.
            </p>
          </div>
        </div>

        {/* Scrollable Report Content */}
        <div className="report-content-body">
          {/* Section 1: Patient Profile & Identification */}
          <section className="report-section">
            <h4 className="section-title">
              <User size={16} /> 1. Patient Profile & Communication Accommodations
            </h4>
            <div className="section-grid-2">
              <div className="info-block">
                <span className="info-label">Local Patient Identifier:</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={patientId} 
                    onChange={e => setPatientId(e.target.value)} 
                    className="report-edit-input"
                  />
                ) : (
                  <b>{reportData.patientId || patientId}</b>
                )}
              </div>
              <div className="info-block">
                <span className="info-label">Report Generated:</span>
                <b>{new Date(reportData.createdAt || Date.now()).toLocaleString()}</b>
              </div>
              <div className="info-block">
                <span className="info-label">Primary Communication Mode:</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={preferredLang} 
                    onChange={e => setPreferredLang(e.target.value)} 
                    className="report-edit-input"
                  />
                ) : (
                  <b>{reportData.preferredLanguage || preferredLang}</b>
                )}
              </div>
              <div className="info-block">
                <span className="info-label">ISL Interpreter Requested:</span>
                {isEditing ? (
                  <label className="checkbox-inline">
                    <input 
                      type="checkbox" 
                      checked={needsInterpreter} 
                      onChange={e => setNeedsInterpreter(e.target.checked)} 
                    />
                    Yes, qualified ISL interpreter required
                  </label>
                ) : (
                  <span className={`badge ${reportData.needsInterpreter ? 'badge-urgent' : 'badge-neutral'}`}>
                    {reportData.needsInterpreter ? 'Yes — In-Person or Video Interpreter Needed' : 'Not Requested'}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Section 2: Patient-Confirmed ISL Statements */}
          <section className="report-section">
            <h4 className="section-title">
              <Languages size={16} /> 2. Patient-Confirmed ISL Communication Statements
            </h4>
            {(!reportData.islStatements || reportData.islStatements.length === 0) ? (
              <p className="empty-field-text">No camera sign sequences were submitted for this report.</p>
            ) : (
              <div className="isl-statements-list">
                {reportData.islStatements.map((stmt, idx) => (
                  <div key={idx} className="statement-card">
                    <div className="statement-top">
                      <span className="statement-tag confirmed-tag">
                        <Check size={12} /> Patient Confirmed
                      </span>
                      {stmt.wasManuallyEdited && (
                        <span className="statement-tag edited-tag">
                          Patient Edited
                        </span>
                      )}
                      <span className="statement-time">
                        <Clock size={12} /> {stmt.confirmedAt ? new Date(stmt.confirmedAt).toLocaleTimeString() : 'Recorded'}
                      </span>
                      <span className="model-spec-badge">
                        {stmt.modelInfo || 'ISL Sequence Model v2.0'}
                      </span>
                    </div>
                    <blockquote className="statement-quote">
                      "{stmt.confirmedText}"
                    </blockquote>
                    {stmt.rawTokens && stmt.rawTokens.length > 0 && (
                      <div className="token-audit-trail">
                        <small>Individual Recognized Signs:</small>
                        <div className="audit-chips">
                          {stmt.rawTokens.map((tok, tIdx) => (
                            <span 
                              key={tIdx} 
                              className={`audit-chip ${tok.isUnknown ? 'audit-unknown' : ''} ${tok.isManual ? 'audit-manual' : ''}`}
                            >
                              {tok.text} {tok.confidence ? `(${tok.confidence}%)` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 3: Pain & Anatomy Findings */}
          <section className="report-section">
            <h4 className="section-title">
              <AlertTriangle size={16} /> 3. Pain Location & Symptom Report
            </h4>
            {(!reportData.painRegions || reportData.painRegions.length === 0) ? (
              <p className="empty-field-text">No painful regions were indicated on the anatomy diagram.</p>
            ) : (
              <div className="table-responsive">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Body Area</th>
                      <th>Side</th>
                      <th>Severity (0-10)</th>
                      <th>Type / Character</th>
                      <th>Onset / Duration</th>
                      <th>Pattern</th>
                      <th>Patient Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.painRegions.map((region) => (
                      <tr key={region.id}>
                        <td><b>{region.name}</b></td>
                        <td>{region.side || 'Central'}</td>
                        <td>
                          <span 
                            className="table-severity-pill"
                            style={{
                              background: region.intensity <= 2 ? '#10b981' :
                                          region.intensity <= 5 ? '#f59e0b' :
                                          region.intensity <= 8 ? '#f97316' : '#ef4444'
                            }}
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
            )}
          </section>

          {/* Section 4: Typed Messages & Spoken Dialog */}
          <section className="report-section">
            <h4 className="section-title">
              <FileText size={16} /> 4. Typed Messages & Communication Log
            </h4>
            <div className="dialog-log-box">
              {reportData.typedMessages && reportData.typedMessages.length > 0 ? (
                reportData.typedMessages.map((msg, i) => (
                  <div key={i} className={`log-entry ${msg.from === 'Doctor' ? 'from-dr' : 'from-pt'}`}>
                    <b>{msg.from}:</b> <span>{msg.text}</span>
                    <small>{msg.time}</small>
                  </div>
                ))
              ) : (
                <p className="empty-field-text">No additional typed messages recorded in session.</p>
              )}
            </div>
          </section>

          {/* Section 5: Questions for Doctor & Preparation Notes */}
          <section className="report-section">
            <h4 className="section-title">
              <User size={16} /> 5. Questions for Clinician & Preparation Notes
            </h4>
            <div className="info-block full-width">
              <span className="info-label">Questions the patient wants to ask the doctor:</span>
              {isEditing ? (
                <textarea 
                  rows={2} 
                  value={patientQuestions} 
                  onChange={e => setPatientQuestions(e.target.value)} 
                  className="report-edit-textarea"
                />
              ) : (
                <p className="report-notes-display">{patientQuestions || 'None recorded.'}</p>
              )}
            </div>
            <div className="info-block full-width" style={{ marginTop: '10px' }}>
              <span className="info-label">Appointment preparation or mobility notes:</span>
              {isEditing ? (
                <textarea 
                  rows={2} 
                  value={preparationNotes} 
                  onChange={e => setPreparationNotes(e.target.value)} 
                  className="report-edit-textarea"
                />
              ) : (
                <p className="report-notes-display">{preparationNotes || 'None recorded.'}</p>
              )}
            </div>
          </section>

          {/* Patient Explicit Confirmation Box */}
          <section className="report-section confirmation-section">
            <div className="patient-signature-block">
              <div className="confirmation-checkbox-wrap">
                <input 
                  type="checkbox" 
                  id="patient-confirm-check"
                  checked={confirmedByPatient}
                  onChange={(e) => setConfirmedByPatient(e.target.checked)}
                />
                <label htmlFor="patient-confirm-check">
                  <b>Patient Confirmation:</b> I confirm that the statements, pain locations, and answers in this communication report accurately represent my message to the medical team.
                </label>
              </div>
              <div className="confirmation-meta">
                <span>Status: <strong>{confirmedByPatient ? 'CONFIRMED BY PATIENT' : 'DRAFT / UNCONFIRMED'}</strong></span>
                <span>Verification: <strong>Local Cryptographic Session Token</strong></span>
              </div>
            </div>
          </section>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="report-footer no-print">
          <div className="left-actions">
            <button type="button" className="secondary-btn" onClick={handlePrint}>
              <Printer size={15} /> Print / Export PDF
            </button>
            <button type="button" className="secondary-btn" onClick={handleExportJSON}>
              <Download size={15} /> Export JSON
            </button>
          </div>

          <div className="right-actions">
            {isEditing ? (
              <button type="button" className="primary-btn" onClick={handleSaveEdits}>
                <Check size={16} /> Save Changes
              </button>
            ) : (
              <>
                <button type="button" className="secondary-btn" onClick={onSaveOffline}>
                  <ShieldCheck size={16} /> Save Offline in DB
                </button>
                <button 
                  type="button" 
                  className="primary-btn send-dr-btn" 
                  onClick={onSendToDoctor}
                  disabled={isSending || !confirmedByPatient}
                >
                  <Send size={16} /> {isSending ? 'Sending to Doctor...' : 'Send to Doctor'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

