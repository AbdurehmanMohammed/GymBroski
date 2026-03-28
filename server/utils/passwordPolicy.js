/** Strong password: 8+ chars, uppercase, lowercase, number, special char */
export function isStrongPassword(str) {
  if (!str || str.length < 8) return false;
  if (!/[A-Z]/.test(str)) return false;
  if (!/[a-z]/.test(str)) return false;
  if (!/[0-9]/.test(str)) return false;
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(str)) return false;
  return true;
}

export const PASSWORD_REQUIREMENTS =
  'Password must be at least 8 characters with uppercase, lowercase, number, and special character (!@#$%^&*).';

/** Platform admin (username login) — only a short minimum, no complexity rules. */
export const PLATFORM_ADMIN_PASSWORD_MIN = 4;
export function isPlatformAdminPasswordOk(str) {
  const s = String(str || '');
  return s.length >= PLATFORM_ADMIN_PASSWORD_MIN && s.length <= 256;
}
