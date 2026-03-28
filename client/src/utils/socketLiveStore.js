import { SOCKET_LIVE_EVENT } from '../constants/socketEvents';

let connected = false;
const listeners = new Set();

/** Updates live state and notifies subscribers (Admin may mount after Socket already connected). */
export function setSocketConnected(value) {
  const v = Boolean(value);
  if (connected === v) return;
  connected = v;
  window.dispatchEvent(new CustomEvent(SOCKET_LIVE_EVENT, { detail: { live: v } }));
  listeners.forEach((fn) => {
    try {
      fn(v);
    } catch {
      /* ignore */
    }
  });
}

/** Immediately calls with current value, then on each change. */
export function subscribeSocketConnected(callback) {
  callback(connected);
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getSocketConnected() {
  return connected;
}
