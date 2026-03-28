/** HttpOnly cookie name for JWT (not readable by JS — common SPA pattern). */
export const AUTH_COOKIE_NAME = 'access_token';

const MS_DAY = 24 * 60 * 60 * 1000;

export function authCookieOptions(rememberMe) {
  const maxAge = rememberMe ? 90 * MS_DAY : 7 * MS_DAY;
  const sameSiteRaw = String(process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  const sameSite = sameSiteRaw === 'none' ? 'none' : 'lax';
  const secure =
    sameSite === 'none' ? true : process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge,
    path: '/',
  };
}

export function setAuthCookie(res, token, rememberMe) {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions(rememberMe));
}

export function clearAuthCookie(res) {
  const sameSiteRaw = String(process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  const sameSite = sameSiteRaw === 'none' ? 'none' : 'lax';
  const secure =
    sameSite === 'none' ? true : process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/', httpOnly: true, secure, sameSite });
}
