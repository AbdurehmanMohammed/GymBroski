/** Default when user leaves “reminder time” empty on schedule step */
export const DEFAULT_REMINDER_HOUR = 6;
export const DEFAULT_REMINDER_MINUTE = 0;

export function parseReminderTimeInput(value) {
  if (value == null || !String(value).trim()) {
    return { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };
  }
  const parts = String(value).trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || h < 0 || h > 23) {
    return { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };
  }
  if (!Number.isFinite(m) || m < 0 || m > 59) {
    return { hour: h, minute: 0 };
  }
  return { hour: h, minute: m };
}

export function formatReminderTimeForInput(hour, minute) {
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isFinite(h) || h < 0 || h > 23) return '';
  if (!Number.isFinite(m) || m < 0 || m > 59) {
    return `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:00`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
