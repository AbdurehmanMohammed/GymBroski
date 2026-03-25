import User from '../models/User.js';
import { sendMail } from './mail.js';

const APP_NAME = process.env.APP_PUBLIC_NAME || 'GymBruski Website';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
/** At most one chat email per user per window (spam guard) */
const THROTTLE_MS = 15 * 60 * 1000;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Notify recipients (except sender) by email when a private/group message is sent.
 */
export async function notifyChatMessageByEmail({
  recipientIds,
  senderName,
  preview,
  conversationLabel
}) {
  if (!Array.isArray(recipientIds) || recipientIds.length === 0) return;

  const senderShort = escapeHtml(String(senderName || 'Someone').trim() || 'Someone');
  const label = escapeHtml(String(conversationLabel || 'Chat').trim() || 'Chat');
  const snippet = escapeHtml(String(preview || '').trim().slice(0, 200));
  const subject = `New message from ${String(senderName || 'Someone').trim().slice(0, 60)} — ${APP_NAME}`;

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:480px;">
      <p style="margin:0 0 12px 0;">Hi,</p>
      <p style="margin:0 0 12px 0;"><strong>${senderShort}</strong> in <strong>${label}</strong>:</p>
      <p style="margin:16px 0;padding:12px 14px;background:#f4f4f5;border-radius:10px;font-size:15px;">${snippet || '(no text)'}</p>
      <p style="margin:20px 0 0 0;">
        <a href="${escapeHtml(APP_URL)}/community" style="color:#4f46e5;font-weight:600;">Open Community &amp; Chat</a>
      </p>
      <p style="margin:16px 0 0 0;font-size:12px;color:#6b7280;">Turn off in Profile → notifications.</p>
    </div>
  `;

  const plain = `${String(senderName || 'Someone').trim()} in ${String(conversationLabel || 'Chat')}: ${String(preview || '').slice(0, 300)}`;

  for (const uid of recipientIds) {
    try {
      const u = await User.findById(uid).select('email emailChatNotifications lastChatEmailNotificationAt');
      if (!u?.email || u.emailChatNotifications === false) {
        continue;
      }

      const last = u.lastChatEmailNotificationAt ? new Date(u.lastChatEmailNotificationAt).getTime() : 0;
      if (Date.now() - last < THROTTLE_MS) {
        console.log('[chatEmail] skipped (throttle) for', u.email);
        continue;
      }

      const result = await sendMail({
        to: u.email,
        subject,
        html,
        text: plain
      });

      if (result.ok && !result.skipped) {
        await User.updateOne({ _id: u._id }, { $set: { lastChatEmailNotificationAt: new Date() } });
        console.log('[chatEmail] sent to', u.email);
      } else if (result.skipped) {
        console.warn('[chatEmail] mail skipped — set RESEND_API_KEY and EMAIL_FROM in server/.env');
      } else {
        console.error('[chatEmail] send failed:', result.error);
      }
    } catch (e) {
      console.error('[chatEmail] notify failed:', e.message);
    }
  }
}
