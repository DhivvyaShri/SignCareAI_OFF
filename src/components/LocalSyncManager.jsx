import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Check, 
  CheckCircle, 
  Cloud, 
  CloudOff, 
  Download, 
  FolderSync, 
  HardDrive, 
  Lock, 
  RefreshCw, 
  Server, 
  ShieldAlert, 
  Trash2, 
  Upload, 
  Wifi, 
  WifiOff, 
  X 
} from 'lucide-react';
import { 
  clearAllLocalDemoData, 
  exportAllData, 
  getPendingSyncQueue, 
  importData, 
  updateSyncStatus 
} from '../utils/db';

export default function LocalSyncManager({
  apiBaseUrl,
  transferMode, // 'modeA' (same device) | 'modeB' (local network)
  setTransferMode,
  onRefreshReports
}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [backendReachable, setBackendReachable] = useState(false);
  const [pendingItems, setPendingItems] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [serverHost, setServerHost] = useState(apiBaseUrl);
  const [authToken, setAuthToken] = useState('LOCAL_HOSPITAL_SECRET_2026');

  // Monitor network online/offline transitions
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodically ping backend
    const checkBackend = async () => {
      try {
        const res = await fetch(`${serverHost}/health`, { signal: AbortSignal.timeout(3000) });
        setBackendReachable(res.ok);
      } catch {
        setBackendReachable(false);
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 6000);

    loadPendingQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [serverHost]);

  const loadPendingQueue = async () => {
    try {
      const items = await getPendingSyncQueue();
      setPendingItems(items);
    } catch (e) {
      console.warn('Could not read sync queue:', e);
    }
  };

  const processSyncQueue = async () => {
    if (!backendReachable && transferMode === 'modeB') {
      setSyncMessage('Cannot sync: Local hospital server unreachable. Check LAN connection.');
      return;
    }

    setSyncing(true);
    setSyncMessage('Processing pending synchronization queue...');

    try {
      const queue = await getPendingSyncQueue();
      let successCount = 0;

      for (const item of queue) {
        if (transferMode === 'modeB') {
          // Transfer to Flask backend
          const res = await fetch(`${serverHost}/api/reports`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(item.payload)
          });

          if (res.ok) {
            await updateSyncStatus(item.id, 'synced');
            successCount++;
          } else {
            await updateSyncStatus(item.id, 'failed', `Server returned ${res.status}`);
          }
        } else {
          // Mode A: Already stored in IndexedDB
          await updateSyncStatus(item.id, 'synced');
          successCount++;
        }
      }

      setSyncMessage(`Sync complete: ${successCount} record(s) synchronized successfully.`);
      loadPendingQueue();
      if (onRefreshReports) onRefreshReports();
    } catch (err) {
      setSyncMessage(`Sync failed: ${err.message}. Records remain preserved offline in IndexedDB.`);
    } finally {
      setSyncing(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const backup = await exportAllData();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SignCare_LocalBackup_${new Date().toISOString().substring(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await importData(parsed);
      alert(`Import complete! ${res.importedReports} reports loaded into local storage.`);
      if (onRefreshReports) onRefreshReports();
      loadPendingQueue();
    } catch (err) {
      alert(`Import failed: ${err.message}. Please select a valid SignCare JSON backup.`);
    }
  };

  const handleClearDemoData = async () => {
    if (window.confirm('Clear all local demo reports, conversation records, and sync queues? This action cannot be undone.')) {
      await clearAllLocalDemoData();
      loadPendingQueue();
      if (onRefreshReports) onRefreshReports();
      alert('Local demo database cleared successfully.');
    }
  };

  return (
    <div className="sync-manager-panel" aria-label="Local Offline Storage and Synchronization">
      <div className="sync-panel-header">
        <div className="sync-title-wrap">
          <FolderSync size={20} className="sync-icon" />
          <div>
            <h4>Offline Storage & Local Hospital Sync</h4>
            <p className="sync-subtitle">Local-first data persistence with dual-mode report transfer.</p>
          </div>
        </div>

        {/* Live Network & Server Status Badges */}
        <div className="sync-badges">
          <span className={`status-pill ${isOnline ? 'online-pill' : 'offline-pill'}`}>
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            {isOnline ? 'Device Network Online' : 'Device Network Offline'}
          </span>
          <span className={`status-pill ${backendReachable ? 'server-pill' : 'server-off-pill'}`}>
            <Server size={13} />
            {backendReachable ? 'Hospital LAN Server Ready' : 'Hospital LAN Server Offline'}
          </span>
        </div>
      </div>

      {/* Transfer Mode Selector */}
      <div className="transfer-mode-selector">
        <label className="mode-option">
          <input 
            type="radio" 
            name="transferMode"
            value="modeA"
            checked={transferMode === 'modeA'}
            onChange={() => setTransferMode('modeA')}
          />
          <div className="mode-card">
            <HardDrive size={18} />
            <div>
              <b>Mode A: Same-Device Demonstration</b>
              <p>Reports saved instantly in browser IndexedDB. Doctor view opens saved records on this computer.</p>
            </div>
          </div>
        </label>

        <label className="mode-option">
          <input 
            type="radio" 
            name="transferMode"
            value="modeB"
            checked={transferMode === 'modeB'}
            onChange={() => setTransferMode('modeB')}
          />
          <div className="mode-card">
            <Server size={18} />
            <div>
              <b>Mode B: Shared Local Hospital Network (LAN)</b>
              <p>Reports transferred securely over the local clinic WiFi/LAN to the configured Flask hospital endpoint without internet access.</p>
            </div>
          </div>
        </label>
      </div>

      {/* Mode B Configuration */}
      {transferMode === 'modeB' && (
        <div className="lan-config-strip">
          <div className="lan-field">
            <label>Local Server URL:</label>
            <input 
              type="text" 
              value={serverHost} 
              onChange={e => setServerHost(e.target.value)} 
              className="lan-input"
              placeholder="http://192.168.1.100:8000"
            />
          </div>
          <div className="lan-field">
            <label>Hospital Auth Token / PIN:</label>
            <input 
              type="password" 
              value={authToken} 
              onChange={e => setAuthToken(e.target.value)} 
              className="lan-input"
            />
          </div>
        </div>
      )}

      {/* Queue Status & Trigger */}
      <div className="sync-queue-status">
        <div className="queue-info">
          <span>Pending sync transfers: <strong>{pendingItems.length} records</strong></span>
          {syncMessage && <p className="sync-feedback">{syncMessage}</p>}
        </div>

        <button 
          type="button" 
          className="primary-btn sync-action-btn"
          onClick={processSyncQueue}
          disabled={syncing || pendingItems.length === 0}
        >
          <RefreshCw size={14} className={syncing ? 'spin' : ''} />
          {syncing ? 'Synchronizing...' : 'Sync Pending Records Now'}
        </button>
      </div>

      {/* Backup, Restore & Privacy Warnings */}
      <div className="sync-footer-actions">
        <div className="backup-buttons">
          <button type="button" className="secondary-btn" onClick={handleExportBackup}>
            <Download size={14} /> Export JSON Backup
          </button>
          
          <label className="secondary-btn import-label">
            <Upload size={14} /> Import Backup JSON
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportBackup} 
              style={{ display: 'none' }} 
            />
          </label>

          <button type="button" className="text-btn danger-text-btn" onClick={handleClearDemoData}>
            <Trash2 size={13} /> Clear Local Demo Records
          </button>
        </div>

        <div className="shared-workstation-notice">
          <ShieldAlert size={14} />
          <span>Shared computer notice: When using on a hospital workstation, clear demo records at end of shift to preserve patient privacy.</span>
        </div>
      </div>
    </div>
  );
}

