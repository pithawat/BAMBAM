// Draft photos (repair CR-026 A1, D-120): the photo files of a form draft stay in this browser's IndexedDB
// until the form is sent or reset, the user logs out, or 24 h pass. lib/drafts.ts keeps the other fields
// (localStorage cannot hold files). Entries carry `savedAt`; browsers have no background timer, so expired
// entries are deleted when the app starts and when a form opens. Every call is best effort, except
// `readDraftPhotos`, which rejects when storage is blocked so the form can ask for the photos again.

const DB_NAME = "bambam.drafts";
const STORE = "photos";
export const DRAFT_PHOTO_TTL_MS = 24 * 60 * 60 * 1000;

/** Files per picker of the form, e.g. `{ photos: [...], team: [...] }`. */
export type DraftPhotoGroups = Record<string, File[]>;
type Entry = { key: string; savedAt: number; groups: DraftPhotoGroups };

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("draft photo store blocked"));
  }).catch((err: unknown) => { opening = null; throw err; });
  return opening;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const conn = await db();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = conn.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const fresh = (e: Entry, now = Date.now()) => now - e.savedAt < DRAFT_PHOTO_TTL_MS;

/** Replaces the photos of one draft (`draftKey(...)`); no files at all removes the entry. */
export async function saveDraftPhotos(key: string, groups: DraftPhotoGroups): Promise<void> {
  try {
    if (!Object.values(groups).some((files) => files.length)) { await clearDraftPhotos(key); return; }
    await run("readwrite", (s) => s.put({ key, savedAt: Date.now(), groups } satisfies Entry));
  } catch {
    // storage unavailable — the draft restores without photos
  }
}

/** The draft's photos, or null when there are none or they are older than 24 h (then deleted). Rejects when blocked. */
export async function readDraftPhotos(key: string): Promise<{ savedAt: number; groups: DraftPhotoGroups } | null> {
  const entry = await run<Entry | undefined>("readonly", (s) => s.get(key));
  if (!entry) return null;
  if (!fresh(entry)) { await clearDraftPhotos(key); return null; }
  return { savedAt: entry.savedAt, groups: entry.groups };
}

export async function clearDraftPhotos(key: string): Promise<void> {
  try { await run("readwrite", (s) => s.delete(key)); } catch { /* ignore */ }
}

/** Logout: drop the draft photos of every user in this browser. */
export async function clearAllDraftPhotos(): Promise<void> {
  try { await run("readwrite", (s) => s.clear()); } catch { /* ignore */ }
}

/** Deletes entries older than 24 h (app start, form open). */
export async function purgeExpiredDraftPhotos(): Promise<void> {
  try {
    const now = Date.now();
    await run("readwrite", (s) => {
      const req = s.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (!fresh(cursor.value as Entry, now)) cursor.delete();
        cursor.continue();
      };
    });
  } catch {
    // ignore
  }
}
