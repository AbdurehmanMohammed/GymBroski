import User from '../models/User.js';
import { sendMail } from './mail.js';

const APP_NAME = process.env.APP_PUBLIC_NAME || 'GymBruski Website';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function notifyCommunityPhotoByEmail({
  actorUserId,
  actorName,
  workoutName,
}) {
  try {
    const recipients = await User.find({
      _id: { $ne: actorUserId },
      emailCommunityPhotoNotifications: { $ne: false },
    }).select('email');

    if (!recipients.length) return;

    const safeActor = escapeHtml(actorName || 'Someone');
    const safeWorkout = escapeHtml(workoutName || 'New post');
    const subject = `📸 ${actorName || 'Someone'} posted: ${workoutName || 'New photo'} — ${APP_NAME}`;
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:520px;">
        <p style="margin:0 0 12px 0;">🔔 <strong>${safeActor}</strong> uploaded a new photo to Bruski's photos.</p>
        <p style="margin:0 0 10px 0;">Workout: <strong>${safeWorkout}</strong></p>
        <p style="margin:18px 0 0 0;">
          <a href="${escapeHtml(APP_URL)}/community" style="color:#4f46e5;font-weight:600;">Open Bruski's Feed</a>
        </p>
        <p style="margin:14px 0 0 0;font-size:12px;color:#6b7280;">Turn this off in Profile → Email settings.</p>
      </div>
    `;

    const text = `${actorName || 'Someone'} uploaded a new photo to Bruski's photos (${workoutName || 'New post'}). ${APP_URL}/community`;

    for (const r of recipients) {
      if (!r.email) continue;
      // Best-effort notify; no blocking failures for post creation.
      await sendMail({ to: r.email, subject, html, text });
    }
  } catch (e) {
    console.error('[communityPhotoEmail] notify failed:', e.message);
  }
}
