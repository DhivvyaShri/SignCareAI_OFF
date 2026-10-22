import React from 'react';
import { 
  Bot, 
  Cpu, 
  Globe, 
  HardDrive, 
  Lock, 
  ShieldCheck, 
  Sparkles, 
  Zap, 
  ZapOff 
} from 'lucide-react';

export default function AIAssistantConfig({ aiMode, setAiMode }) {
  return (
    <div className="ai-config-widget" aria-label="Clinical AI Engine Selector">
      <div className="ai-config-header">
        <div className="ai-title-wrap">
          <Sparkles size={18} className="ai-header-icon" />
          <div>
            <h5>Clinical AI Engine & Offline Intelligence</h5>
            <small>Select local offline processing or optional local/cloud LLM.</small>
          </div>
        </div>
        <div className={`active-mode-tag mode-${aiMode}`}>
          {aiMode === 'offline' && '● OFFLINE LOCAL MODE (100% AIR-GAPPED)'}
          {aiMode === 'ollama' && '● LOCAL OLLAMA / NEMOTRON MODE'}
          {aiMode === 'nvidia' && '● ONLINE NVIDIA NIM MODE'}
          {aiMode === 'disabled' && '○ MANUAL MODE (AI DISABLED)'}
        </div>
      </div>

      <div className="ai-modes-grid">
        {/* Mode 1: Offline Local Deterministic */}
        <button
          type="button"
          className={`ai-card ${aiMode === 'offline' ? 'active' : ''}`}
          onClick={() => setAiMode('offline')}
        >
          <div className="ai-card-top">
            <HardDrive size={18} />
            <b>Offline Local Mode</b>
            <span className="rec-badge">Recommended</span>
          </div>
          <p>
            Deterministic, rule-based clinical report summarizer. Zero network requests, 100% offline, zero hallucination risk, runs on any laptop.
          </p>
        </button>

        {/* Mode 2: Local AI (Ollama / Local Nemotron) */}
        <button
          type="button"
          className={`ai-card ${aiMode === 'ollama' ? 'active' : ''}`}
          onClick={() => setAiMode('ollama')}
        >
          <div className="ai-card-top">
            <Cpu size={18} />
            <b>Local AI Mode (Ollama)</b>
          </div>
          <p>
            Connects to locally running Ollama (e.g. Nemotron-Mini / Llama 3) on <code>http://localhost:11434</code> without external internet access.
          </p>
        </button>

        {/* Mode 3: Online NVIDIA NIM */}
        <button
          type="button"
          className={`ai-card ${aiMode === 'nvidia' ? 'active' : ''}`}
          onClick={() => setAiMode('nvidia')}
        >
          <div className="ai-card-top">
            <Globe size={18} />
            <b>Online NVIDIA AI Mode</b>
          </div>
          <p>
            Optional cloud-hosted NVIDIA Nemotron NIM enhancement. Requires internet connection and <code>NVIDIA_API_KEY</code>.
          </p>
        </button>

        {/* Mode 4: AI Disabled / Manual Mode */}
        <button
          type="button"
          className={`ai-card ${aiMode === 'disabled' ? 'active' : ''}`}
          onClick={() => setAiMode('disabled')}
        >
          <div className="ai-card-top">
            <ZapOff size={18} />
            <b>Manual Mode Active</b>
          </div>
          <p>
            Completely disables AI summaries. Only raw patient-entered text, selected cards, and confirmed communication are displayed.
          </p>
        </button>
      </div>

      <div className="ai-safety-alert">
        <Lock size={13} />
        <span>
          <strong>Privacy Guarantee:</strong> When Offline Local Mode or Local AI Mode is chosen, the application never connects to external servers or cloud APIs. All summarization remains on this computer.
        </span>
      </div>
    </div>
  );
}

