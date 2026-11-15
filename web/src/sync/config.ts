/** where the sync server lives: websockets for rooms, plain http for creating seeded rooms (ws -> http, wss -> https) */
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
export const SERVER_HTTP = WS_URL.replace(/^ws/, "http");

/**
 * Render's free tier sleeps the server after ~15 min idle and takes ~50 s to wake. Ping /health on page load so
 * it is already awake by the time someone clicks Share or opens a room link. Fire and forget: "no-cors" because
 * we never read the reply (no CORS rule needed), and a failure just means the next real request waits instead.
 */
export function wakeServer(fetchFn: typeof fetch = fetch): void {
  fetchFn(`${SERVER_HTTP}/health`, { mode: "no-cors" }).catch(() => {});
}
