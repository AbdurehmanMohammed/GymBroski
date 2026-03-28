import { getParsedAuthUser } from './authStorage';

/** Whether the logged-in user has admin role (from session auth, set at login). */
export function isAdminUser() {
  try {
    return getParsedAuthUser()?.role === 'admin';
  } catch {
    return false;
  }
}
