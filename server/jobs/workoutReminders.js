import { DateTime } from 'luxon';
import User from '../models/User.js';
import WorkoutSplit from '../models/WorkoutSplit.js';
import { sendMail } from '../services/mail.js';

const APP_NAME = process.env.APP_PUBLIC_NAME || 'GymBruski Website';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

const MOTIVATIONAL = [
  'Show up for yourself today — one session at a time.',
  'Consistency beats perfection. You’ve got this.',
  'The bar doesn’t care about yesterday. Own this workout.',
  'Strong isn’t a look — it’s a decision you make today.',
  'Progress is built rep by rep. Let’s move.',
  'Your future self will thank you for starting.',
  'Energy flows where focus goes — lock in.',
  'Small steps today, big gains tomorrow.'
];

function luxonToJsWeekday(lw) {
  return lw === 7 ? 0 : lw;
}

function firstName(full) {
  if (!full || !String(full).trim()) return 'champion';
  return String(full).trim().split(/\s+/)[0];
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inReminderWindow(now, hour, minute, windowMinutes = 25) {
  const start = now.set({ hour, minute, second: 0, millisecond: 0 });
  const end = start.plus({ minutes: windowMinutes });
  return now >= start && now < end;
}

/** One “start of day” send per user — time from env, not Profile (default 6:00 local) */
function getMorningReminderTime() {
  const h = parseInt(process.env.WORKOUT_REMINDER_DAY_START_HOUR ?? '6', 10);
  const m = parseInt(process.env.WORKOUT_REMINDER_DAY_START_MINUTE ?? '0', 10);
  return {
    hour: Number.isNaN(h) ? 6 : Math.min(23, Math.max(0, h)),
    minute: Number.isNaN(m) ? 0 : Math.min(59, Math.max(0, m))
  };
}

function pickMotivation() {
  return MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];
}

const DEBUG = process.env.WORKOUT_REMINDER_DEBUG === 'true';

function dbg(email, msg) {
  if (DEBUG && email) console.log('[workoutReminders]', email, msg);
}

export async function runWorkoutReminderJob() {
  if (process.env.WORKOUT_REMINDER_CRON === 'false') {
    return { ran: false, reason: 'disabled' };
  }

  const users = await User.find({ emailWorkoutReminders: { $ne: false } })
    .select(
      'email name emailWorkoutReminders workoutSchedule workoutReminderHour workoutReminderMinute timezone lastWorkoutReminderSentOn'
    )
    .lean();

  let sent = 0;

  for (const u of users) {
    const logEmail = u.email || String(u._id);

    if (!Array.isArray(u.workoutSchedule) || u.workoutSchedule.length === 0) {
      dbg(logEmail, 'skip: no workout schedule (assign days when you create or edit a workout)');
      continue;
    }

    const tz = u.timezone?.trim() || 'UTC';
    let now;
    try {
      now = DateTime.now().setZone(tz);
    } catch {
      console.warn('[workoutReminders] bad timezone — fix in Profile:', tz, u._id);
      continue;
    }

    const jsDow = luxonToJsWeekday(now.weekday);
    const sched = Array.isArray(u.workoutSchedule) ? u.workoutSchedule : [];
    const entry = sched.find((s) => Number(s.day) === jsDow);
    if (!entry || !entry.workoutId) {
      dbg(
        logEmail,
        `skip: no workout for today (weekday ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][jsDow]} in ${tz})`
      );
      continue;
    }

    const wid = entry.workoutId?._id ?? entry.workoutId;

    const { hour: h, minute: m } = getMorningReminderTime();
    if (!inReminderWindow(now, h, m)) {
      dbg(
        logEmail,
        `skip: not in morning window (local ${now.toFormat('HH:mm')} — send window starts ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} for 25 min; set WORKOUT_REMINDER_DAY_START_HOUR in .env to change)`
      );
      continue;
    }

    const todayKey = now.toFormat('yyyy-MM-dd');
    if (u.lastWorkoutReminderSentOn === todayKey) {
      dbg(logEmail, 'skip: already sent today');
      continue;
    }

    const workout = await WorkoutSplit.findOne({
      _id: wid,
      userId: u._id
    }).lean();

    if (!workout) {
      console.warn('[workoutReminders] skip: workout not found for id', wid, logEmail);
      continue;
    }

    const greet = firstName(u.name);
    const wname = workout.name || 'Your workout';
    const desc = (workout.description || '').trim();
    const exCount = Array.isArray(workout.exercises) ? workout.exercises.length : 0;
    const motivation = pickMotivation();

    const subject = `🏋️ ${APP_NAME} — ${wname} today`;
    const html = `
      <p>Hi <strong>${escapeHtml(greet)}</strong>,</p>
      <p>Today you’re scheduled for <strong>${escapeHtml(wname)}</strong>.</p>
      ${desc ? `<p style="color:#334155;">${escapeHtml(desc)}</p>` : ''}
      ${exCount ? `<p>${exCount} exercise${exCount === 1 ? '' : 's'} in this split — open the app when you’re ready.</p>` : ''}
      <p style="margin:20px 0;padding:14px 16px;background:#f1f5f9;border-radius:10px;border-left:4px solid #6366f1;font-style:italic;color:#334155;">
        ${escapeHtml(motivation)}
      </p>
      <p><a href="${APP_URL}/dashboard" style="color:#4f46e5;font-weight:600;">Open ${escapeHtml(APP_NAME)} →</a></p>
      <p style="color:#94a3b8;font-size:12px;">You’re receiving this because workout reminders are on in your profile.</p>
    `;

    const text = `Hi ${greet}, today you're scheduled for "${wname}". ${motivation} ${APP_URL}/dashboard`;

    const result = await sendMail({ to: u.email, subject, html, text });
    if (result.skipped || !result.ok) {
      console.warn(
        '[workoutReminders] email NOT sent:',
        logEmail,
        result.skipped ? '(set RESEND_API_KEY + EMAIL_FROM)' : result.error || 'unknown'
      );
      continue;
    }

    await User.updateOne({ _id: u._id }, { $set: { lastWorkoutReminderSentOn: todayKey } });
    sent++;
    console.log('[workoutReminders] sent workout email to', logEmail);
  }

  return { ran: true, checked: users.length, sent };
}
