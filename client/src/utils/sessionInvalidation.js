/** Hard redirect to login — same outcome as Socket.io `session:invalidate`. */
export function invalidateClientSession(reason = 'ended') {
  const q = reason === 'suspended' ? 'suspended' : reason === 'removed' ? 'removed' : 'ended';
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.replace(`/login?session=${q}`);
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
  // 403 is used for many non-auth failures at the edge; only sign out when the API sent a real message.
  if (status === 403 && !String(message).trim()) return false;
  invalidateClientSession('removed');
  return true;
}
