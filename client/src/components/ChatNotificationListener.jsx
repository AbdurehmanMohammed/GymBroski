import { useChatBrowserNotifications } from '../hooks/useChatBrowserNotifications';

export default function ChatNotificationListener() {
  useChatBrowserNotifications();
  return null;
}
