/** Fired when sessionStorage auth user is written or cleared — keeps route guards in sync (prod + mobile). */
export const AUTH_SESSION_UPDATED = 'gym-auth-session-updated';

export function notifyAuthSessionUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_UPDATED));
}
