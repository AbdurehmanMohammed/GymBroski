import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { isPlatformAdminPasswordOk, PLATFORM_ADMIN_PASSWORD_MIN } from '../utils/passwordPolicy.js';

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,30}$/;

/**
 * Creates or updates the dedicated platform admin (username + password login).
 * Env:
 *   ADMIN_USERNAME (default: admin)
 *   ADMIN_PASSWORD — required; no mixed-case/symbol rules (min length only, see PLATFORM_ADMIN_PASSWORD_MIN)
 *   ADMIN_ACCOUNT_EMAIL — unique internal email (default: platform-admin@internal.gymbruski.app)
 */
export async function ensurePlatformAdminFromEnv() {
  const password = String(process.env.ADMIN_PASSWORD || '').trim();
  if (!password) {
    console.log(
      '[admin] ADMIN_PASSWORD not set — skipping platform admin account. Set ADMIN_USERNAME (default admin), ADMIN_PASSWORD, and optional ADMIN_ACCOUNT_EMAIL.'
    );
    return;
  }

  if (!isPlatformAdminPasswordOk(password)) {
    console.warn(
      `[admin] ADMIN_PASSWORD must be at least ${PLATFORM_ADMIN_PASSWORD_MIN} characters (no complexity rules for platform admin).`
    );
    return;
  }

  const username = String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    console.warn('[admin] ADMIN_USERNAME must be 2–31 chars: lowercase letters, digits, . _ -');
    return;
  }

  const internalEmail = String(
    process.env.ADMIN_ACCOUNT_EMAIL || 'platform-admin@internal.gymbruski.app'
  )
    .trim()
    .toLowerCase();

  const byUser = await User.findOne({ username });
  const byEmail = await User.findOne({ email: internalEmail });
  if (byUser && byEmail && String(byUser._id) !== String(byEmail._id)) {
    console.warn(
      '[admin] ADMIN_USERNAME and ADMIN_ACCOUNT_EMAIL match different users — fix database or env.'
    );
    return;
  }

  let user = byUser || byEmail;
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  if (user) {
    user.username = username;
    user.email = internalEmail;
    user.password = hashedPassword;
    user.role = 'admin';
    if (!user.name?.trim()) user.name = 'Platform Admin';
    await user.save();
    console.log(`[admin] Platform admin updated: login with username "${username}"`);
    return;
  }

  user = new User({
    name: 'Platform Admin',
    email: internalEmail,
    username,
    password: hashedPassword,
    role: 'admin',
    points: 0,
  });
  await user.save();
  console.log(`[admin] Platform admin created: login username "${username}" + ADMIN_PASSWORD from .env`);
}
