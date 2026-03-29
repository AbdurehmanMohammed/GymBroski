/** Whether the logged-in user has admin role (from localStorage, set at login). */
export function isAdminUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return false;
    const u = JSON.parse(raw);
    return u?.role === 'admin';
  } catch {
    return false;
  }
}
