import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { getAdminSocketUrl } from '../utils/adminSocketUrl';
import { isAdminUser } from '../utils/authRole';
import { ADMIN_REFRESH_EVENT } from '../constants/socketEvents';
import { setSocketConnected } from '../utils/socketLiveStore';
import { authAPI } from '../services/api';
import { invalidateClientSession } from '../utils/sessionInvalidation';

/**
 * Socket.io + periodic API session ping (fallback when static site and API are on different hosts).
 * Auth: httpOnly cookie sent via withCredentials (same as REST).
 */
export default function SessionSocketBridge() {
  useEffect(() => {
    let socket;
    let cancelled = false;
    let adminDebounce;
    let pingTimer;
    let onVis;

    const scheduleAdminRefresh = (detail) => {
      clearTimeout(adminDebounce);
      adminDebounce = setTimeout(() => {
        window.dispatchEvent(new CustomEvent(ADMIN_REFRESH_EVENT, { detail }));
      }, 90);
    };

    (async () => {
      const { status } = await authAPI.sessionPing();
      if (cancelled) return;
      if (status !== 200) {
        setSocketConnected(false);
        return;
      }

      socket = io(getAdminSocketUrl(), {
        path: '/socket.io',
        withCredentials: true,
        transports: ['polling', 'websocket'],
        reconnectionAttempts: 12,
        reconnectionDelay: 800,
        timeout: 20000,
      });

      const onConnect = () => setSocketConnected(true);
      const onDisconnect = () => setSocketConnected(false);
      const onConnectError = (err) => {
        setSocketConnected(false);
        console.warn(
          '[socket] connect_error — realtime push may be unavailable.',
          err?.message || err
        );
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

      /**
       * Periodic ping only — do not logout on 401/403 (cookie can lag after login on mobile / cross-site).
       * Account removal: rely on Socket `session:invalidate` or 401 from real API calls (Dashboard, etc.).
       */
      const runSessionPing = async () => {
        if (document.visibilityState !== 'visible') return;
        try {
          await authAPI.sessionPing();
        } catch {
          /* network blip */
        }
      };
      pingTimer = window.setInterval(runSessionPing, 60000);
      onVis = () => {
        if (document.visibilityState === 'visible') runSessionPing();
      };
      document.addEventListener('visibilitychange', onVis);
    })();

    return () => {
      cancelled = true;
      clearInterval(pingTimer);
      if (onVis) document.removeEventListener('visibilitychange', onVis);
      clearTimeout(adminDebounce);
      if (socket) {
        socket.off('reconnect');
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('admin:refresh');
        socket.off('session:invalidate');
        socket.close();
      }
      setSocketConnected(false);
    };
  }, []);

  return null;
}
