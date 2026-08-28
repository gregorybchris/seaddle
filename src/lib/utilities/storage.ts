/**
 * The browser's own memory, for the few things this site keeps in it.
 *
 * Storage can be missing or refuse to answer — a private window, a browser set
 * to block site data — and everything kept here is a convenience rather than a
 * reason for the page to fail. An unavailable store reads as empty and swallows
 * what is written to it, so no caller carries its own try/catch.
 */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do about it, and nothing worth interrupting the ride for.
  }
}

/** The same, for a value that was written as JSON. Unreadable is missing. */
export function readStoredJson<T>(key: string, fallback: T): T {
  const raw = readStored(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key: string, value: unknown): void {
  writeStored(key, JSON.stringify(value));
}
