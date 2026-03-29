/**
 * JWT lives in an httpOnly cookie (set by API). Client keeps a cached `user` object
 * in sessionStorage for UI; GET /auth/me restores it when the cookie is valid (e.g. new tab).
 */
import { authAPI } from '../services/api.js';
import { notifyAuthSessionUpdated } from './authSessionEvents.js';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function getStore() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

(function clearLegacyPersistedAuth() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    getStore()?.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
})();

export function getAuthUserJson() {
  try {
    return getStore()?.getItem(USER_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setAuthUserJson(userObject) {
  if (userObject == null || typeof userObject !== 'object' || Array.isArray(userObject)) {
    return;
  }
  const u = { ...userObject };
  if (userObject.id != null) {
    u.id = String(userObject.id);
  } else if (userObject._id != null) {
    u.id = String(userObject._id);
  }
  getStore()?.setItem(USER_KEY, JSON.stringify(u));
}

/** Call after login/register so route guards re-read session (does not remount socket on every profile save). */
export function setAuthUserJsonAndNotify(userObject) {
  setAuthUserJson(userObject);
  notifyAuthSessionUpdated();
}

export function getParsedAuthUser() {
  try {
    const raw = getAuthUserJson();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Clear cached user only (cookie unchanged). */
export function clearAuthSession() {
  try {
    getStore()?.removeItem(USER_KEY);
    getStore()?.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
  notifyAuthSessionUpdated();
}

/** Clear server session cookie and client user cache (use for logout). */
export async function signOutEverywhere() {
  try {
    await authAPI.logout();
  } catch {
    /* ignore */
  }
  clearAuthSession();
}
