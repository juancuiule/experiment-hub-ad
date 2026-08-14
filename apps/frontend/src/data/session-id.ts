const STORAGE_KEY = 'experiment-hub:session-id';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    // Only available in secure contexts (HTTPS/localhost).
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    // getRandomValues works in non-secure contexts too; build a v4 UUID by hand.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = toHex(bytes);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last resort for environments without the Web Crypto API at all.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedSessionId: string | null = null;

/**
 * Returns a session id that is stable for the lifetime of this tab: cached in
 * module scope (survives StrictMode's double-invoke and repeated start()
 * calls) and mirrored to sessionStorage (survives remounts within the tab).
 */
export function getSessionId(): string {
  if (cachedSessionId) {
    return cachedSessionId;
  }

  if (typeof sessionStorage !== 'undefined') {
    try {
      const existing = sessionStorage.getItem(STORAGE_KEY);
      if (existing) {
        cachedSessionId = existing;
        return cachedSessionId;
      }
      const generated = generateId();
      sessionStorage.setItem(STORAGE_KEY, generated);
      cachedSessionId = generated;
      return cachedSessionId;
    } catch {
      // sessionStorage unavailable (private browsing, disabled storage, SSR) — fall through.
    }
  }

  cachedSessionId = generateId();
  return cachedSessionId;
}
