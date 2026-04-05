const LB_PER_KG = 2.2046226218;
const KG_PER_LB = 0.45359237;

/** Workout session / photo post `totalVolume` is stored in kg — use for social feed in lb. */
export function totalVolumeKgToLb(totalVolumeKg) {
  const n = Number(totalVolumeKg);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * LB_PER_KG);
}

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

/** Normalize API / form values (handles casing, lbs, missing). */
export function normalizeWeightUnit(raw) {
  const u = String(raw ?? '').trim().toLowerCase();
  if (u === 'kg' || u === 'kgs' || u === 'kilogram' || u === 'kilograms') return 'kg';
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return 'lb';
  return '';
}

/**
 * Display unit for a workout exercise (create/edit/start session).
 * Only 'kg' if explicitly kg; otherwise 'lb' (matches editor default + legacy data without weightUnit).
 */
export function exerciseWeightUnit(ex) {
  return normalizeWeightUnit(ex?.weightUnit) === 'kg' ? 'kg' : 'lb';
}

const SS_KEY = (workoutId) => `weightUnits:${String(workoutId)}`;

/** Remember units after save so Start session matches edit even if API omits weightUnit (stale server). */
export function persistWorkoutExerciseUnits(workoutId, exercises) {
  if (workoutId == null || workoutId === '') return;
  try {
    const o = {};
    (exercises || []).forEach((e, i) => {
      const u = exerciseWeightUnit(e);
      o[`${String(e.name || '').trim()}::${i}`] = u;
    });
    sessionStorage.setItem(SS_KEY(workoutId), JSON.stringify(o));
  } catch (_) {
    /* ignore quota / private mode */
  }
}

/**
 * Unit for active session: API first, then sessionStorage from last save, else lb.
 */
export function resolveExerciseWeightUnit(ex, exerciseIndex, workoutId) {
  const direct = normalizeWeightUnit(ex?.weightUnit);
  if (direct === 'kg' || direct === 'lb') return direct;
  if (workoutId == null || workoutId === '') return 'lb';
  try {
    const raw = sessionStorage.getItem(SS_KEY(workoutId));
    if (!raw) return 'lb';
    const o = JSON.parse(raw);
    const key = `${String(ex?.name || '').trim()}::${exerciseIndex}`;
    const cached = normalizeWeightUnit(o[key]);
    if (cached === 'kg' || cached === 'lb') return cached;
  } catch (_) {
    /* ignore */
  }
  return 'lb';
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
