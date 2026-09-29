/** Tiny, crash-proof localStorage helpers for the store: private windows,
 * blocked storage or corrupt values fall back to defaults instead of
 * breaking the app. */
export function readStored<T>(key: string, parse: (raw: string) => T | undefined, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v = parse(raw);
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the setting just won't persist */
  }
}

export const parseJson = <T,>(raw: string): T | undefined => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};
