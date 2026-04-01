import React, { useState, useEffect } from 'react';
import { FiX, FiPlus, FiMinus, FiGlobe, FiCalendar } from 'react-icons/fi';
import { workoutAPI, profileAPI } from '../services/api';
import { mergeScheduleForWorkout, getTrainingDaysForWorkoutFromUser } from '../utils/workoutScheduleMerge';
import { getExerciseDemoVideoUrl } from '../utils/exerciseDemoVideo';
import { filterExercisesByNameQuery } from '../data/exerciseLibrary';
import {
  convertWeightBetweenUnits,
  weightDisplayToStoredKg,
  storedKgToDisplay,
} from '../utils/weightUnits';
import { formatReminderTimeForInput, parseReminderTimeInput } from '../utils/reminderTime';

function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const WEEKDAY_PICKER = [
  { d: 0, short: 'Sun' },
  { d: 1, short: 'Mon' },
  { d: 2, short: 'Tue' },
  { d: 3, short: 'Wed' },
  { d: 4, short: 'Thu' },
  { d: 5, short: 'Fri' },
  { d: 6, short: 'Sat' },
];

function normalizeDefaultReps(reps) {
  const raw = String(reps ?? '').trim();
  return raw.startsWith('10-12') ? '10' : (raw || '10');
}

const EditWorkout = ({ workout, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: workout.name,
    description: workout.description || '',
    isPublic: workout.isPublic,
    exercises: workout.exercises.length > 0
      ? workout.exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets,
          reps: normalizeDefaultReps(ex.reps),
          weight: ex.weight === 0 || ex.weight === '0' ? '' : storedKgToDisplay(ex.weight, 'lb'),
          weightUnit: 'lb',
          muscleGroup: ex.muscleGroup || 'Other',
        }))
      : [{ name: '', sets: 3, reps: '10', weight: '', weightUnit: 'lb', muscleGroup: 'Other' }]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nameSuggestRow, setNameSuggestRow] = useState(null);
  const [trainingDays, setTrainingDays] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return getTrainingDaysForWorkoutFromUser(u, workout._id);
    } catch {
      return [];
    }
  });
  const [scheduleReminderTime, setScheduleReminderTime] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return formatReminderTimeForInput(u.workoutReminderHour, u.workoutReminderMinute);
    } catch {
      return '';
    }
  });

  /** Login only stored a slim user — load real schedule + reminder time from API so we don’t show empty days or wipe the server on save. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prof = await profileAPI.getProfile();
        if (cancelled) return;
        const sched = Array.isArray(prof.workoutSchedule) ? prof.workoutSchedule : [];
        setTrainingDays(getTrainingDaysForWorkoutFromUser({ workoutSchedule: sched }, workout._id));
        setScheduleReminderTime(formatReminderTimeForInput(prof.workoutReminderHour, prof.workoutReminderMinute));
        try {
          const raw = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem(
            'user',
            JSON.stringify({
              ...raw,
              workoutSchedule: sched,
              workoutReminderHour: prof.workoutReminderHour,
              workoutReminderMinute: prof.workoutReminderMinute,
              timezone: prof.timezone || raw.timezone,
              emailWorkoutReminders: prof.emailWorkoutReminders,
            })
          );
        } catch {
          /* ignore */
        }
      } catch {
        /* offline / stale token — keep localStorage-derived state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workout._id]);

  const toggleTrainingDay = (d) => {
    setTrainingDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  const isExerciseWeightProvided = (ex) => {
    const w = ex.weight;
    if (w == null) return false;
    return String(w).trim() !== '';
  };

  const patchExercise = (index, patch) => {
    setFormData((prev) => {
      const row = [...prev.exercises];
      row[index] = { ...row[index], ...patch };
      return { ...prev, exercises: row };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const missingWeightIdx = formData.exercises.findIndex((ex) => !isExerciseWeightProvided(ex));
    if (missingWeightIdx >= 0) {
      setError(
        'Every exercise needs a weight. Enter a number (kg or lb), 0 if you use no added weight, or Bodyweight.'
      );
      window.requestAnimationFrame(() => {
        const el = document.getElementById(`edit-exercise-weight-${missingWeightIdx}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus();
      });
      return;
    }
    setLoading(true);

    const payload = {
      ...formData,
      exercises: formData.exercises.map((ex) => {
        const unit = ex.weightUnit || 'lb';
        let w;
        if (ex.weight == null || String(ex.weight).trim() === '') {
          w = 0;
        } else if (/^bodyweight$/i.test(String(ex.weight).trim())) {
          w = ex.weight;
        } else {
          const kgStr = weightDisplayToStoredKg(ex.weight, unit);
          w = kgStr === '' || kgStr === '0' || parseFloat(kgStr) === 0 ? 0 : kgStr;
        }
        return {
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: w,
          muscleGroup: ex.muscleGroup || 'Other',
          videoUrl: getExerciseDemoVideoUrl(ex.name),
        };
      }),
    };

    try {
      await workoutAPI.update(workout._id, payload);
      try {
        const raw = JSON.parse(localStorage.getItem('user') || '{}');
        let existing = Array.isArray(raw.workoutSchedule) ? raw.workoutSchedule : [];
        try {
          const latestProfile = await profileAPI.getProfile();
          if (Array.isArray(latestProfile.workoutSchedule)) {
            existing = latestProfile.workoutSchedule;
          }
        } catch {
          /* fallback to local cached schedule */
        }
        const merged = mergeScheduleForWorkout(existing, workout._id, trainingDays);
        const { hour, minute } = parseReminderTimeInput(scheduleReminderTime);
        const prof = await profileAPI.updateProfile({
          workoutSchedule: merged,
          timezone: getDeviceTimeZone(),
          workoutReminderHour: hour,
          workoutReminderMinute: minute,
        });
        localStorage.setItem('user', JSON.stringify({ ...raw, ...prof }));
      } catch (schedErr) {
        console.error(schedErr);
        alert(
          schedErr?.message
            ? `Workout saved, but schedule update failed: ${schedErr.message}`
            : 'Workout saved, but schedule could not be updated. Try again from edit.'
        );
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating workout:', err);
      setError(err?.message || 'Failed to update workout');
    } finally {
      setLoading(false);
    }
  };

  const addExercise = () => {
    setFormData({
      ...formData,
      exercises: [
        ...formData.exercises,
        { name: '', sets: 3, reps: '10', weight: '', weightUnit: 'lb', muscleGroup: 'Other' },
      ]
    });
  };

  const removeExercise = (index) => {
    const newExercises = formData.exercises.filter((_, i) => i !== index);
    setFormData({ ...formData, exercises: newExercises });
  };

  const updateExercise = (index, field, value) => {
    const newExercises = [...formData.exercises];
    newExercises[index][field] = value;
    setFormData({ ...formData, exercises: newExercises });
  };

  const applyLibraryToExerciseRow = (index, libEx) => {
    setNameSuggestRow(null);
    setFormData((prev) => {
      const next = [...prev.exercises];
      next[index] = {
        ...next[index],
        name: libEx.name,
        sets: libEx.defaultSets,
        reps: normalizeDefaultReps(libEx.defaultReps),
        weight:
          libEx.defaultWeight && libEx.defaultWeight !== '0' ? libEx.defaultWeight : '',
        weightUnit: 'lb',
        muscleGroup: libEx.muscleGroup,
      };
      return { ...prev, exercises: next };
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Edit Workout Split</h2>
          <button onClick={onClose} className="close-btn" type="button">
            <FiX />
          </button>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Workout Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Push Day, Leg Day"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Describe your workout..."
              rows="3"
            />
          </div>

          <div className={`public-visibility-card ${formData.isPublic ? 'checked' : ''}`}>
            <div className="public-visibility-icon">
              <FiGlobe size={20} />
            </div>
            <div className="public-visibility-content">
              <span className="public-visibility-title">Share on Community Feed</span>
              <span className="public-visibility-desc">Other users can discover and copy this workout</span>
            </div>
            <label className="public-visibility-toggle">
              <input
                type="checkbox"
                id="isPublic"
                checked={formData.isPublic}
                onChange={(e) => setFormData({...formData, isPublic: e.target.checked})}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="exercises-section">
            <h3>Exercises</h3>
            {formData.exercises.map((exercise, index) => {
              const nameSuggestions = filterExercisesByNameQuery(exercise.name);
              const showNameSuggestions = nameSuggestRow === index && nameSuggestions.length > 0;
              return (
              <div key={index} className="exercise-form">
                <div className="exercise-header">
                  <div className="exercise-name-autocomplete-wrap">
                    <input
                      id={`edit-exercise-name-${index}`}
                      type="text"
                      placeholder="Exercise name — type to search (e.g. bic)"
                      value={exercise.name}
                      onChange={(e) => updateExercise(index, 'name', e.target.value)}
                      onFocus={() => setNameSuggestRow(index)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setNameSuggestRow((prev) => (prev === index ? null : prev));
                        }, 180);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setNameSuggestRow(null);
                      }}
                      autoComplete="off"
                      required
                      aria-autocomplete="list"
                      aria-expanded={showNameSuggestions}
                      aria-controls={`edit-exercise-name-suggestions-${index}`}
                    />
                    {showNameSuggestions ? (
                      <ul
                        className="exercise-name-suggestions"
                        id={`edit-exercise-name-suggestions-${index}`}
                        role="listbox"
                      >
                        {nameSuggestions.map((libEx) => (
                          <li key={libEx.name} role="presentation">
                            <button
                              type="button"
                              className="exercise-name-suggestion-btn"
                              role="option"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => applyLibraryToExerciseRow(index, libEx)}
                            >
                              <span className="suggestion-title">{libEx.name}</span>
                              <span className="suggestion-meta">
                                {libEx.muscleGroup}
                                {libEx.equipment ? ` • ${libEx.equipment}` : ''}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {formData.exercises.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeExercise(index)}
                      className="remove-exercise"
                    >
                      <FiMinus />
                    </button>
                  )}
                </div>

                <div className="exercise-details">
                  <div>
                    <label>Sets</label>
                    <input
                      type="number"
                      min="1"
                      value={exercise.sets}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || v === '-') return;
                        const n = parseInt(v, 10);
                        if (Number.isNaN(n) || n < 1) return;
                        updateExercise(index, 'sets', v);
                      }}
                    />
                  </div>
                  <div>
                    <label>Reps</label>
                    <input
                      type="text"
                      placeholder="e.g. 8-12 or 10"
                      value={exercise.reps ?? ''}
                      onChange={(e) => updateExercise(index, 'reps', e.target.value)}
                    />
                  </div>
                  <div className="exercise-weight-block">
                    <label htmlFor={`edit-exercise-weight-${index}`}>Weight — required</label>
                    <div className="weight-unit-toggle" role="group" aria-label="Weight unit">
                      <button
                        type="button"
                        className={`weight-unit-toggle__btn ${(exercise.weightUnit || 'lb') === 'kg' ? 'active' : ''}`}
                        onClick={() => {
                          const cur = exercise.weightUnit || 'lb';
                          if (cur === 'kg') return;
                          const w = convertWeightBetweenUnits(exercise.weight, 'lb', 'kg');
                          patchExercise(index, { weight: w, weightUnit: 'kg' });
                        }}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        className={`weight-unit-toggle__btn ${(exercise.weightUnit || 'lb') === 'lb' ? 'active' : ''}`}
                        onClick={() => {
                          const cur = exercise.weightUnit || 'lb';
                          if (cur === 'lb') return;
                          const w = convertWeightBetweenUnits(exercise.weight, 'kg', 'lb');
                          patchExercise(index, { weight: w, weightUnit: 'lb' });
                        }}
                      >
                        lb
                      </button>
                    </div>
                    <input
                      id={`edit-exercise-weight-${index}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 40, 0, or Bodyweight"
                      value={exercise.weight === 0 || exercise.weight === '0' ? '' : (exercise.weight ?? '')}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || v === '-') {
                          updateExercise(index, 'weight', v);
                          return;
                        }
                        const n = parseFloat(v);
                        if (!Number.isNaN(n) && n < 0) return;
                        updateExercise(index, 'weight', v);
                      }}
                    />
                  </div>
                </div>
              </div>
              );
            })}

            <button type="button" onClick={addExercise} className="add-exercise-btn">
              <FiPlus /> Add Exercise
            </button>
          </div>

          <div className="create-schedule-step edit-workout-schedule-step">
            <div className="create-schedule-hero" style={{ marginBottom: 14 }}>
              <div className="create-schedule-hero-icon" aria-hidden>
                <FiCalendar size={22} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>Reminder days for this split</h3>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-subtle)' }}>
                  Tap days you train <strong>{formData.name || 'this workout'}</strong>. Cleared days become rest for
                  this split. Other workouts on other days are unchanged.
                </p>
              </div>
            </div>
            <div className="create-schedule-day-grid" role="group" aria-label="Training days">
              {WEEKDAY_PICKER.map(({ d, short }) => {
                const on = trainingDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    className={`create-schedule-day-btn${on ? ' create-schedule-day-btn--on' : ''}`}
                    onClick={() => toggleTrainingDay(d)}
                    aria-pressed={on}
                  >
                    <span className="dow-full">{short}</span>
                  </button>
                );
              })}
            </div>
            <div className="create-schedule-reminder">
              <label htmlFor="edit-schedule-reminder-time" className="create-schedule-reminder-label">
                Reminder time <span className="create-schedule-reminder-optional">(optional)</span>
              </label>
              <input
                id="edit-schedule-reminder-time"
                type="time"
                className="create-schedule-reminder-input"
                value={scheduleReminderTime}
                onChange={(e) => setScheduleReminderTime(e.target.value)}
                aria-describedby="edit-schedule-reminder-hint"
              />
              <p id="edit-schedule-reminder-hint" className="create-schedule-reminder-hint">
                Default <strong>6:00 AM</strong> in {getDeviceTimeZone()} if left blank. Same time applies to all
                scheduled workout reminders.
              </p>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Updating...' : 'Update Workout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditWorkout;
