import nodemailer from 'nodemailer';

/** Trim + strip accidental quotes — Windows .env often adds \\r which breaks Bearer auth */
function getResendApiKey() {
  return String(process.env.RESEND_API_KEY || '')
    .trim()
    .replace(/\r/g, '')
    .replace(/^["']|["']$/g, '');
}

function getEmailFrom() {
  let f = String(process.env.EMAIL_FROM || '')
    .trim()
    .replace(/\r/g, '');
  if ((f.startsWith('"') && f.endsWith('"')) || (f.startsWith("'") && f.endsWith("'"))) {
    f = f.slice(1, -1);
  }
  return f.trim();
}

function hasResend() {
  return Boolean(getResendApiKey() && getEmailFrom());
}

function hasSmtp() {
  return Boolean(process.env.SMTP_URL || process.env.SMTP_HOST);
}

/** True when workout/chat transactional email can be sent (Resend or SMTP + from address). */
export function isMailConfigured() {
  return Boolean((hasResend() && getEmailFrom()) || (hasSmtp() && getEmailFrom()));
}

let smtpTransporter = null;
function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  const url = process.env.SMTP_URL;
  if (url) {
    smtpTransporter = nodemailer.createTransport(url);
    return smtpTransporter;
  }
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  smtpTransporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined
  });
  return smtpTransporter;
}

export async function sendMail({ to, subject, html, text }) {
  const from = getEmailFrom();
  if (!to || !subject) return { ok: false, error: 'missing to/subject' };

  if (hasResend()) {
    const apiKey = getResendApiKey();
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text: text || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[mail] Resend failed:', res.status, JSON.stringify(data));
        const errMsg = data?.message || data?.name || res.statusText;
        if (
          res.status === 403 &&
          String(errMsg).toLowerCase().includes('testing emails')
        ) {
          console.error(
            '[mail] Resend sandbox: you can only send TO your own Resend account email until you verify a domain at https://resend.com/domains and set EMAIL_FROM to an address on that domain.'
          );
        }
        return { ok: false, error: errMsg };
      }
      return { ok: true, id: data?.id };
    } catch (e) {
      console.error('[mail] Resend:', e.message);
      return { ok: false, error: e.message };
    }
  }

  const t = getSmtpTransporter();
  if (t && from) {
    try {
      const info = await t.sendMail({ from, to, subject, html, text: text || undefined });
      return { ok: true, id: info.messageId };
    } catch (e) {
      console.error('[mail] SMTP:', e.message);
      return { ok: false, error: e.message };
    }
  }

  console.warn('[mail] Skipped (set RESEND_API_KEY+EMAIL_FROM or SMTP):', to);
  return { ok: false, skipped: true };
}
