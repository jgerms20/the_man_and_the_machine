import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { SessionData } from './SessionRecorder';

const DB_NAME = 'man-and-machine-db';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

// ── Serialisation helpers ────────────────────────────────────────────────────
// IndexedDB can store Blobs natively, but we keep a thin wrapper in case the
// host environment needs JSON fallback (e.g., structured-clone quirks).

type StoredSession = Omit<SessionData, 'audioBlob'> & {
  audioBlob: Blob | null;
};

// ── DB singleton ─────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null;

export function initDB(): Promise<IDBPDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
    blocked() {
      console.warn('SessionStorage: DB upgrade blocked by an older open tab.');
    },
    blocking() {
      // This version is blocking a newer upgrade — close so the tab can proceed.
      dbPromise = null;
    },
    terminated() {
      console.error('SessionStorage: DB connection unexpectedly terminated.');
      dbPromise = null;
    },
  });

  return dbPromise;
}

async function getDB(): Promise<IDBPDatabase> {
  return initDB();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function saveSession(data: SessionData): Promise<void> {
  const db = await getDB();
  const record: StoredSession = { ...data };
  await db.put(STORE_NAME, record);
}

export async function loadSession(id: string): Promise<SessionData | undefined> {
  const db = await getDB();
  const record = await db.get(STORE_NAME, id) as StoredSession | undefined;
  if (!record) return undefined;
  return { ...record };
}

export async function listSessions(): Promise<SessionData[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME) as StoredSession[];
  return all.map((r) => ({ ...r }));
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function clearAllSessions(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
