/** Holds Socket.io instance; routes call notifyAdmins / invalidateUserSession. */
let ioRef = null;

export function setAdminIo(ioInstance) {
  ioRef = ioInstance;
}

export function notifyAdmins(payload = {}) {
  ioRef?.to('admins').emit('admin:refresh', {
    ...payload,
    at: new Date().toISOString(),
  });
}

/** Push to every socket in `user:<userId>` — client clears session and redirects. */
export function invalidateUserSession(userId, payload = {}) {
  const id = String(userId);
  ioRef?.to(`user:${id}`).emit('session:invalidate', {
    reason: payload.reason || 'unknown',
    userId: id,
    at: new Date().toISOString(),
    ...payload,
  });
}

/** Force disconnect so the target client drops immediately (after invalidate). */
export async function disconnectUserSockets(userId) {
  if (!ioRef) return;
  try {
    await ioRef.in(`user:${String(userId)}`).disconnectSockets(true);
  } catch (e) {
    console.error('[socket] disconnectUserSockets', e);
  }
}
