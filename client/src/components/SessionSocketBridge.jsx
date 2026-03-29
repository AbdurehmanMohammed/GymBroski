import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { getAdminSocketUrl } from '../utils/adminSocketUrl';
import { isAdminUser } from '../utils/authRole';
import { ADMIN_REFRESH_EVENT } from '../constants/socketEvents';
import { setSocketConnected } from '../utils/socketLiveStore';
import { authAPI } from '../services/api';
import { invalidateClientSession, invalidateFromAuthFailure } from '../utils/sessionInvalidation';

/**
 * Socket.io + periodic API session ping (fallback when static site and API are on different hosts).
 */
export default function SessionSocketBridge() {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setSocketConnected(false);
      return undefined;
    }

    const socket = io(getAdminSocketUrl(), {
      path: '/socket.io',
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 12,
      reconnectionDelay: 800,
      timeout: 20000,
    });

    let adminDebounce;
    const scheduleAdminRefresh = (detail) => {
      clearTimeout(adminDebounce);
      adminDebounce = setTimeout(() => {
        window.dispatchEvent(new CustomEvent(ADMIN_REFRESH_EVENT, { detail }));
      }, 90);
    };

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    const onConnectError = (err) => {
      setSocketConnected(false);
      console.warn('[socket] connect_error — realtime push may be unavailable; session ping will still sign out deleted users.', err?.message || err);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('reconnect', onConnect);

    socket.on('session:invalidate', (payload) => {
      const reason = String(payload?.reason || '');
      socket.disconnect();
      let r = 'ended';
      if (reason === 'account_suspended') r = 'suspended';
      else if (reason === 'account_deleted') r = 'removed';
      invalidateClientSession(r);
    });

    socket.on('admin:refresh', (payload) => {
      if (isAdminUser()) scheduleAdminRefresh(payload);
    });

    if (socket.connected) setSocketConnected(true);

    /** When Socket.io cannot connect to the API, this still detects deleted/suspended accounts within ~15s. */
    let pingTimer;
    const runSessionPing = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!localStorage.getItem('token')) return;
      try {
        const { status, message, shouldInvalidate } = await authAPI.sessionPing();
        if (shouldInvalidate) {
          invalidateFromAuthFailure(status, message);
        }
      } catch {
        /* network blip — ignore */
      }
    };
    pingTimer = window.setInterval(runSessionPing, 10000);
    const onVis = () => {
      if (document.visibilityState === 'visible') runSessionPing();
    };
    document.addEventListener('visibilitychange', onVis);
    const pingBoot = window.setTimeout(runSessionPing, 8000);

    return () => {
      clearTimeout(pingBoot);
      clearInterval(pingTimer);
      document.removeEventListener('visibilitychange', onVis);
      clearTimeout(adminDebounce);
      socket.off('reconnect', onConnect);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('admin:refresh');
      socket.off('session:invalidate');
      socket.close();
      setSocketConnected(false);
    };
  }, []);

  return null;
}
