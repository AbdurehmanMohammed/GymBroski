/**
 * Minimal cookie lookup from Cookie header (no dependency).
 * @param {string|undefined} header
 * @param {string} name
 */
export function getCookieFromHeader(header, name) {
  if (!header || !name) return null;
  const parts = header.split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    if (k !== name) continue;
    return decodeURIComponent(p.slice(idx + 1).trim());
  }
  return null;
}
