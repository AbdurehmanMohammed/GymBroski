/**
 * Socket.io must reach the **API origin**, not the static site (e.g. Render static + API on another URL).
 * Set VITE_API_URL=https://your-api.onrender.com/api (socket base = same host without /api).
 * Optional override: VITE_SOCKET_URL=https://your-api.onrender.com
 */
export function getAdminSocketUrl() {
  const explicit = String(import.meta.env.VITE_SOCKET_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;

  if (import.meta.env.DEV) return window.location.origin;

  const raw = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (raw.endsWith('/api')) return raw.slice(0, -4);
  if (raw) return raw;

  if (import.meta.env.PROD) {
    console.warn(
      '[gym] Realtime: set VITE_API_URL (e.g. https://your-api.onrender.com/api) or VITE_SOCKET_URL so Socket.io hits your API. Using this page\'s host usually fails for static hosting.'
    );
  }
  return window.location.origin;
}
