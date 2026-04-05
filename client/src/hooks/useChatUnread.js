import { useState, useEffect } from 'react';
import { chatAPI } from '../services/api';

const POLL_INTERVAL = 20000; // 20 seconds

/**
 * Hook that fetches total unread private chat count and polls periodically.
 * Use this to show a notification badge on the Chat tab and Bruski's Feed nav.
 */
export function useChatUnread() {
  const [count, setCount] = useState(0);

  const fetchUnread = async () => {
    try {
      const convs = await chatAPI.getConversations();
      const total = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      setCount(total);
    } catch (_) {
      setCount(0);
    }
  };

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return count;
}
