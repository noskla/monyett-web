// Global 429 handling: any API response with 429 notifies subscribers; App shows
// a full-screen countdown overlay until the Retry-After timeout ends.

let blockedUntil = 0;
const listeners = new Set<() => void>();

export function notifyRateLimit(seconds: number) {
  blockedUntil = Date.now() + seconds * 1000;
  listeners.forEach((l) => l());
}

export function getBlockedUntil() {
  return blockedUntil;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
