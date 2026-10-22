// IndexedDB Local-First Persistence Layer for SignCare AI
const DB_NAME = 'SignCareLocalDB';
const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store 1: Patient Reports
      if (!db.objectStoreNames.contains('reports')) {
        const reportStore = db.createObjectStore('reports', { keyPath: 'id' });
        reportStore.createIndex('createdAt', 'createdAt', { unique: false });
        reportStore.createIndex('status', 'status', { unique: false });
        reportStore.createIndex('patientId', 'patientId', { unique: false });
      }

      // Store 2: Communication & Conversation Messages
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Store 3: Local Sync Queue (for offline-to-server dispatch)
      if (!db.objectStoreNames.contains('sync_queue')) {
        const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        syncStore.createIndex('status', 'status', { unique: false });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
}

// Reports CRUD
export async function saveReport(report) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reports', 'readwrite');
    const store = tx.objectStore('reports');
    const record = {
      ...report,
      updatedAt: new Date().toISOString()
    };
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllReports() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reports', 'readonly');
    const store = tx.objectStore('reports');
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getReportById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reports', 'readonly');
    const store = tx.objectStore('reports');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteReportById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reports', 'readwrite');
    const store = tx.objectStore('reports');
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// Conversation Messages
export async function saveMessage(msg) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const req = store.add({ ...msg, savedAt: new Date().toISOString() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllMessages() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// Sync Queue
export async function queueForSync(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const record = {
      id: item.id || `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      payload: item,
      status: 'pending', // pending, synced, failed
      retries: 0,
      createdAt: new Date().toISOString()
    };
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingSyncQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []).filter(r => r.status === 'pending'));
    req.onerror = () => reject(req.error);
  });
}

export async function updateSyncStatus(syncId, status, errorMsg = '') {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const getReq = store.get(syncId);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) return resolve(null);
      record.status = status;
      record.lastAttempt = new Date().toISOString();
      if (errorMsg) record.lastError = errorMsg;
      if (status === 'failed') record.retries = (record.retries || 0) + 1;
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// Export / Import / Clear Demo Data
export async function exportAllData() {
  const reports = await getAllReports();
  const messages = await getAllMessages();
  return {
    version: '1.0',
    exportTimestamp: new Date().toISOString(),
    reports,
    messages
  };
}

export async function importData(jsonData) {
  if (!jsonData || !Array.isArray(jsonData.reports)) {
    throw new Error('Invalid SignCare backup JSON file.');
  }
  const db = await openDB();
  const tx = db.transaction(['reports', 'messages'], 'readwrite');
  const reportStore = tx.objectStore('reports');
  for (const rep of jsonData.reports) {
    reportStore.put(rep);
  }
  if (Array.isArray(jsonData.messages)) {
    const messageStore = tx.objectStore('messages');
    for (const msg of jsonData.messages) {
      messageStore.put(msg);
    }
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve({ importedReports: jsonData.reports.length });
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllLocalDemoData() {
  const db = await openDB();
  const tx = db.transaction(['reports', 'messages', 'sync_queue'], 'readwrite');
  tx.objectStore('reports').clear();
  tx.objectStore('messages').clear();
  tx.objectStore('sync_queue').clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

