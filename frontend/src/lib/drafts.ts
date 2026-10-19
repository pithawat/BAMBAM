// Local form drafts (design-system.md "Draft"): kept in this browser per employee code, so a
// reload — e.g. after the phone switched to the camera — does not lose a long form.
// Every key starts with DRAFT_PREFIX; logout clears them all. Storage can be missing or full
// (private mode), so every call is best effort.

const DRAFT_PREFIX = "bambam.draft.";

export function draftKey(form: string, employeeCode: string) {
  return `${DRAFT_PREFIX}${form}.${employeeCode}`;
}

export function readDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — the form still works without a draft
  }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Logout: drop every draft of every user in this browser. */
export function clearAllDrafts() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(DRAFT_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
