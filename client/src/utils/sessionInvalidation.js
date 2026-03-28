import { signOutEverywhere } from './authStorage';

/** Hard redirect to login — same outcome as Socket.io `session:invalidate`. */
export function invalidateClientSession(reason = 'ended') {
  const q = reason === 'suspended' ? 'suspended' : reason === 'removed' ? 'removed' : 'ended';
  void signOutEverywhere().finally(() => {
    window.location.replace(`/login?session=${q}`);
  });
}

/**
 * After an authenticated request returns 401/403 (deleted user, suspended, bad JWT).
 * @returns {boolean} true if redirect was triggered
 */
export function invalidateFromAuthFailure(status, message = '') {
  if (status !== 401 && status !== 403) return false;
  const low = String(message).toLowerCase();
  if (low.includes('suspend')) {
    invalidateClientSession('suspended');
    return true;
  }
  invalidateClientSession('removed');
  return true;
}
