const LB_PER_KG = 2.2046226218;
const KG_PER_LB = 0.45359237;

/** Convert numeric weight string between kg ↔ lb; preserves Bodyweight / non-numeric text. */
export function convertWeightBetweenUnits(val, from, to) {
  if (from === to) return val == null ? '' : String(val);
  const t = String(val ?? '').trim();
  if (t === '' || /^bodyweight$/i.test(t)) return t;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return String(val);
  if (from === 'kg' && to === 'lb') return String(Math.round(n * LB_PER_KG * 10) / 10);
  if (from === 'lb' && to === 'kg') return String(Math.round(n * KG_PER_LB * 100) / 100);
  return String(val);
}

/** User input in chosen unit → stored kg string for API (numbers); Bodyweight unchanged. */
export function weightDisplayToStoredKg(weight, unit) {
  const t = String(weight ?? '').trim();
  if (t === '') return '';
  if (/^bodyweight$/i.test(t)) return t;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return t;
  if (unit === 'lb') return String(Math.round(n * KG_PER_LB * 100) / 100);
  return String(n);
}

/** API stores kg — show in UI for lb mode */
export function storedKgToDisplay(stored, unit) {
  if (stored == null || stored === '') return '';
  const t = String(stored).trim();
  if (/^bodyweight$/i.test(t)) return t;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return t;
  if (unit === 'lb') return String(Math.round(n * LB_PER_KG * 10) / 10);
  return t;
}
