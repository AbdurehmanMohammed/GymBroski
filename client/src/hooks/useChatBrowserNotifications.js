import { useEffect, useRef } from 'react';
import { chatAPI } from '../services/api';
import { getParsedAuthUser } from '../utils/authStorage';

const POLL_INTERVAL = 20000;

/**
 * Desktop chat alerts: on by default (no in-app toggle).
 * Browsers still require a one-time permission — we request it quietly on the first
 * click/tap anywhere while logged in (no extra prompts from our app).
 */
export function useChatBrowserNotifications() {
  const prevUnreadRef = useRef(null);

  // One-time: ask the browser for notification permission after a real user gesture
  useEffect(() => {
    const onFirstGesture = () => {
      if (!getParsedAuthUser()?.id) return;
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'default') return;
      Notification.requestPermission().catch(() => {});
    };
    window.addEventListener('pointerdown', onFirstGesture, { once: true, capture: true });
    return () => window.removeEventListener('pointerdown', onFirstGesture, { capture: true });
  }, []);

  useEffect(() => {
    const tick = async () => {
      if (!getParsedAuthUser()?.id) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      try {
        const convs = await chatAPI.getConversations();
        const total = convs.reduce((s, c) => s + (c.unreadCount || 0), 0);

        if (prevUnreadRef.current !== null && total > prevUnreadRef.current) {
          const delta = total - prevUnreadRef.current;
          if (document.visibilityState === 'hidden') {
            new Notification(delta === 1 ? 'New message' : `${delta} new messages`, {
              body: 'Open Community → Chat to read.',
              icon: '/favicon.ico',
              tag: 'gym-chat-unread'
            });
          }
        }
        prevUnreadRef.current = total;
      } catch (_) {
        /* ignore */
      }
    };

    tick();
    const id = setInterval(tick, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);
}
