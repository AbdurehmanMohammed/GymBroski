/**
 * JWT lives in an httpOnly cookie (set by API). Client keeps a cached `user` object
 * in sessionStorage for UI; GET /auth/me restores it when the cookie is valid (e.g. new tab).
 */
import { authAPI } from '../services/api.js';

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
  getStore()?.setItem(USER_KEY, JSON.stringify(userObject));
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
