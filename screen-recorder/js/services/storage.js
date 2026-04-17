const DB_NAME = 'screen-recorder';
const DB_VERSION = 1;
const STORE = 'recordings';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecording({ blob, mimeType, durationSec, name }) {
  const db = await openDb();
  const record = {
    blob,
    mimeType,
    durationSec,
    name: name || defaultName(),
    size: blob.size,
    createdAt: Date.now()
  };
  const id = await promisify(tx(db, 'readwrite').add(record));
  return { ...record, id };
}

export async function listRecordings() {
  const db = await openDb();
  const store = tx(db, 'readonly');
  const index = store.index('createdAt');
  const results = [];
  return new Promise((resolve, reject) => {
    const req = index.openCursor(null, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getRecording(id) {
  const db = await openDb();
  return promisify(tx(db, 'readonly').get(Number(id)));
}

export async function deleteRecording(id) {
  const db = await openDb();
  return promisify(tx(db, 'readwrite').delete(Number(id)));
}

export async function renameRecording(id, name) {
  const db = await openDb();
  const store = tx(db, 'readwrite');
  const rec = await promisify(store.get(Number(id)));
  if (!rec) return null;
  rec.name = name;
  await promisify(store.put(rec));
  return rec;
}

function defaultName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `Recording ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}`;
}
