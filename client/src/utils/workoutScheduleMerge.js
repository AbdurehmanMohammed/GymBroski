/**
 * Merge weekly schedule when assigning `workoutId` to `selectedDays` (0=Sun … 6=Sat).
 * - Removes this workout from every day first, then assigns it to `selectedDays`.
 * - Other workouts stay on their days unless a selected day overwrites them.
 */
export function mergeScheduleForWorkout(existingRows, workoutId, selectedDays) {
  const sel = new Set((selectedDays || []).map((d) => Number(d)).filter((d) => d >= 0 && d <= 6 && !Number.isNaN(d)));
  const wid = String(workoutId);
  const byDay = new Map();

  for (const row of existingRows || []) {
    const d = Number(row.day);
    if (d < 0 || d > 6 || Number.isNaN(d)) continue;
    const id = row.workoutId?._id ?? row.workoutId;
    if (!id) continue;
    const sid = String(id);
    if (sid === wid) continue;
    byDay.set(d, sid);
  }

  for (const d of sel) {
    byDay.set(d, wid);
  }

  return Array.from(byDay.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, w]) => ({ day, workoutId: w }));
}

export function getTrainingDaysForWorkoutFromUser(user, workoutId) {
  if (!user || !workoutId) return [];
  const sched = Array.isArray(user.workoutSchedule) ? user.workoutSchedule : [];
  const id = String(workoutId);
  return sched
    .filter((r) => String(r.workoutId?._id ?? r.workoutId) === id)
    .map((r) => Number(r.day))
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b);
}
