import React, { useState, useMemo } from 'react';
import { FiX, FiPlus, FiMinus, FiSearch, FiZap, FiLayers, FiLock, FiUsers, FiCalendar } from 'react-icons/fi';
import { workoutAPI, profileAPI } from '../services/api';
import { mergeScheduleForWorkout } from '../utils/workoutScheduleMerge';
import {
  EXERCISE_LIBRARY,
  WORKOUT_TEMPLATES,
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  EXERCISE_LIBRARY_FILTER_LABELS,
  filterExercisesByNameQuery,
} from '../data/exerciseLibrary';
import { getExerciseDemoVideoUrl } from '../utils/exerciseDemoVideo';
import {
  convertWeightBetweenUnits,
  weightDisplayToStoredKg,
} from '../utils/weightUnits';
import { getParsedAuthUser, setAuthUserJson } from '../utils/authStorage';

// AI suggests workout based on muscle group (rule-based, no external API)
function getAIWorkout(muscleGroups) {
  const exercises = [];
  const muscleMap = {
    Chest: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Cable Chest Fly', 'Push-ups'],
    Back: ['Deadlift', 'Bent Over Barbell Row', 'Lat Pulldown', 'Face Pull'],
    Shoulders: ['Overhead Press', 'Lateral Raise', 'Rear Delt Fly'],
    Arms: ['Barbell Curl', 'Rope Pushdown', 'Hammer Curl', 'Skull Crushers'],
    Legs: ['Barbell Squat', 'Romanian Deadlift', 'Leg Press', 'Lying Leg Curl', 'Standing Calf Raise'],
    Core: ['Plank', 'Crunches', 'Russian Twists', 'Hanging Leg Raise'],
    Cardio: ['Treadmill Running', 'Jump Rope', 'Rowing Machine'],
  };
  muscleGroups.forEach((mg) => {
    (muscleMap[mg] || []).forEach((name) => {
      const lib = EXERCISE_LIBRARY.find((e) => e.name === name);
      if (lib) {
        exercises.push({
          name: lib.name,
          sets: lib.defaultSets,
          reps: lib.defaultReps,
          weight: (lib.defaultWeight && lib.defaultWeight !== '0') ? lib.defaultWeight : '',
          weightUnit: 'kg',
          muscleGroup: lib.muscleGroup,
        });
      }
    });
  });
  return exercises;
}

function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const WEEKDAY_PICKER = [
  { d: 0, short: 'Sun', full: 'Sunday' },
  { d: 1, short: 'Mon', full: 'Monday' },
  { d: 2, short: 'Tue', full: 'Tuesday' },
  { d: 3, short: 'Wed', full: 'Wednesday' },
  { d: 4, short: 'Thu', full: 'Thursday' },
  { d: 5, short: 'Fri', full: 'Friday' },
  { d: 6, short: 'Sat', full: 'Saturday' },
];

const CreateWorkout = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState('library'); // library | template | ai | manual
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
    exercises: [],
  });
  const [search, setSearch] = useState('');
  const [filterMuscle, setFilterMuscle] = useState('All');
  const [filterEquipment, setFilterEquipment] = useState('All');
  const [aiMuscleGroups, setAiMuscleGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** build → visibility → schedule (training days) → save */
  const [phase, setPhase] = useState('build');
  const [trainingDays, setTrainingDays] = useState([]);
  /** Which exercise row shows the name autocomplete dropdown */
  const [nameSuggestRow, setNameSuggestRow] = useState(null);

  const filteredExercises = useMemo(() => {
    let list = EXERCISE_LIBRARY;
    if (filterMuscle !== 'All') list = list.filter((e) => e.muscleGroup === filterMuscle);
    if (filterEquipment !== 'All') list = list.filter((e) => (e.equipment || 'Other') === filterEquipment);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    return list;
  }, [search, filterMuscle, filterEquipment]);

  const addFromLibrary = (ex) => {
    const exists = formData.exercises.some((e) => e.name === ex.name);
    if (exists) return;
    setFormData({
      ...formData,
      exercises: [
        ...formData.exercises,
        {
          name: ex.name,
          sets: ex.defaultSets,
          reps: ex.defaultReps,
          weight: (ex.defaultWeight && ex.defaultWeight !== '0') ? ex.defaultWeight : '',
          weightUnit: 'kg',
          muscleGroup: ex.muscleGroup,
        },
      ],
    });
  };

  const applyTemplate = (tpl) => {
    setFormData({
      ...formData,
      name: tpl.name,
      description: tpl.description || '',
      exercises: tpl.exercises.map((e) => ({
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weight: (e.weight && e.weight !== '0') ? e.weight : '',
        weightUnit: 'kg',
        muscleGroup: e.muscleGroup || 'Other',
      })),
    });
  };

  const generateAI = () => {
    if (aiMuscleGroups.length === 0) return;
    const exs = getAIWorkout(aiMuscleGroups);
    setFormData({
      ...formData,
      name: `AI ${aiMuscleGroups.join(' + ')} Workout`,
      description: `AI-generated workout targeting: ${aiMuscleGroups.join(', ')}`,
      exercises: exs,
    });
  };

  const toggleAiMuscle = (mg) => {
    setAiMuscleGroups((prev) =>
      prev.includes(mg) ? prev.filter((m) => m !== mg) : [...prev, mg]
    );
  };

  /** Use functional update + stop event so a mis-typed button never submits the parent form */
  const addExercise = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    setFormData((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        { name: '', sets: 3, reps: '10', weight: '', weightUnit: 'kg', muscleGroup: 'Other' },
      ],
    }));
  };

  const removeExercise = (index) => {
    setFormData({ ...formData, exercises: formData.exercises.filter((_, i) => i !== index) });
  };

  const updateExercise = (index, field, value) => {
    const next = [...formData.exercises];
    next[index] = { ...next[index], [field]: value };
    setFormData({ ...formData, exercises: next });
  };

  const patchExercise = (index, patch) => {
    setFormData((prev) => {
      const row = [...prev.exercises];
      row[index] = { ...row[index], ...patch };
      return { ...prev, exercises: row };
    });
  };

  const applyLibraryToExerciseRow = (index, libEx) => {
    setNameSuggestRow(null);
    setFormData((prev) => {
      const next = [...prev.exercises];
      next[index] = {
        ...next[index],
        name: libEx.name,
        sets: libEx.defaultSets,
        reps: libEx.defaultReps,
        weight:
          libEx.defaultWeight && libEx.defaultWeight !== '0' ? libEx.defaultWeight : '',
        weightUnit: 'kg',
        muscleGroup: libEx.muscleGroup,
      };
      return { ...prev, exercises: next };
    });
  };

  const isExerciseWeightProvided = (ex) => {
    const w = ex.weight;
    if (w == null) return false;
    return String(w).trim() !== '';
  };

  const goToVisibilityStep = (e) => {
    e?.preventDefault();
    if (formData.exercises.length === 0) {
      setError('Add at least one exercise');
      return;
    }
    const emptyNameIdx = formData.exercises.findIndex((ex) => !String(ex.name || '').trim());
    if (emptyNameIdx >= 0) {
      setError('Every exercise needs a name.');
      window.requestAnimationFrame(() => {
        const el = document.getElementById(`create-exercise-name-${emptyNameIdx}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus();
      });
      return;
    }
    const missingWeightIdx = formData.exercises.findIndex((ex) => !isExerciseWeightProvided(ex));
    if (missingWeightIdx >= 0) {
      setError(
        'Every exercise needs a weight. Enter a number (kg or lb), 0 if no added weight, or Bodyweight.'
      );
      window.requestAnimationFrame(() => {
        const el = document.getElementById(`create-exercise-weight-${missingWeightIdx}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus();
      });
      return;
    }
    setError('');
    setPhase('visibility');
  };

  const createPayload = () => ({
    ...formData,
    exercises: formData.exercises.map((ex) => {
      const unit = ex.weightUnit || 'kg';
      const raw = ex.weight;
      let weightStr;
      if (raw == null || String(raw).trim() === '') {
        weightStr = '0';
      } else if (/^bodyweight$/i.test(String(raw).trim())) {
        weightStr = String(raw).trim();
      } else {
        const kg = weightDisplayToStoredKg(raw, unit);
        weightStr =
          kg === '' || kg === '0' || parseFloat(kg) === 0 ? '0' : kg;
      }
      return {
        name: ex.name,
        sets: Number(ex.sets) || 3,
        reps: String(ex.reps ?? 10),
        weight: weightStr,
        muscleGroup: ex.muscleGroup || 'Other',
        videoUrl: getExerciseDemoVideoUrl(ex.name),
      };
    }),
  });

  const toggleTrainingDay = (d) => {
    setTrainingDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  const handleFinalCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const created = await workoutAPI.create(createPayload());
      const wid = created._id || created.id;
      if (!wid) throw new Error('Server did not return a workout id');

      if (trainingDays.length > 0) {
        try {
          const raw = getParsedAuthUser() || {};
          const existing = Array.isArray(raw.workoutSchedule) ? raw.workoutSchedule : [];
          const merged = mergeScheduleForWorkout(existing, wid, trainingDays);
          const prof = await profileAPI.updateProfile({
            workoutSchedule: merged,
            timezone: getDeviceTimeZone(),
          });
          setAuthUserJson({ ...raw, ...prof });
        } catch (schedErr) {
          console.error(schedErr);
          alert(
            schedErr?.message
              ? `Workout saved, but schedule update failed: ${schedErr.message}`
              : 'Workout saved, but training days could not be saved. Edit the workout to set days.'
          );
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to create workout');
    } finally {
      setLoading(false);
    }
  };

  const phaseTitle =
    phase === 'build'
      ? 'Create Workout Split'
      : phase === 'visibility'
        ? 'Who can see this workout?'
        : 'When do you train?';

  const modes = [
    { id: 'library', label: 'Exercise Library', icon: FiSearch },
    { id: 'template', label: 'Templates', icon: FiLayers },
    { id: 'ai', label: 'AI Workout', icon: FiZap },
    { id: 'manual', label: 'Manual Add', icon: FiPlus },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-workout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header create-workout-header">
          <div>
            <h2>{phaseTitle}</h2>
            {phase === 'visibility' && (
              <p className="create-workout-subtitle">
                Share with the community or keep it private — then you&apos;ll pick training days.
              </p>
            )}
            {phase === 'schedule' && (
              <p className="create-workout-subtitle">
                Choose which days you&apos;ll run <strong>{formData.name || 'this split'}</strong>. Other days stay as
                they are — or rest if nothing is scheduled. Morning emails use your device time zone (
                {getDeviceTimeZone()}).
              </p>
            )}
          </div>
          <button onClick={onClose} className="close-btn" type="button">
            <FiX />
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {phase === 'build' && (
          <>
        <form onSubmit={goToVisibilityStep} className="create-form">
          <div className="form-group">
            <label>Workout Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Push Day"
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your workout..."
              rows="2"
            />
          </div>
          <div className="exercises-section">
            <h3>Your Exercises ({formData.exercises.length})</h3>
            {formData.exercises.map((ex, i) => {
              const nameSuggestions = filterExercisesByNameQuery(ex.name);
              const showNameSuggestions = nameSuggestRow === i && nameSuggestions.length > 0;
              return (
              <div key={i} className="exercise-form">
                <div className="exercise-header">
                  <div className="exercise-name-autocomplete-wrap">
                    <input
                      id={`create-exercise-name-${i}`}
                      type="text"
                      placeholder="Exercise name — type to search (e.g. bic)"
                      value={ex.name}
                      onChange={(e) => updateExercise(i, 'name', e.target.value)}
                      onFocus={() => setNameSuggestRow(i)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setNameSuggestRow((prev) => (prev === i ? null : prev));
                        }, 180);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setNameSuggestRow(null);
                      }}
                      autoComplete="off"
                      required
                      aria-autocomplete="list"
                      aria-expanded={showNameSuggestions}
                      aria-controls={`exercise-name-suggestions-${i}`}
                    />
                    {showNameSuggestions ? (
                      <ul
                        className="exercise-name-suggestions"
                        id={`exercise-name-suggestions-${i}`}
                        role="listbox"
                      >
                        {nameSuggestions.map((libEx) => (
                          <li key={libEx.name} role="presentation">
                            <button
                              type="button"
                              className="exercise-name-suggestion-btn"
                              role="option"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => applyLibraryToExerciseRow(i, libEx)}
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
                      onClick={() => removeExercise(i)}
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
                      min={1}
                      value={ex.sets}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (e.target.value !== '' && (Number.isNaN(v) || v < 1)) return;
                        updateExercise(i, 'sets', e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <label>Reps</label>
                    <input
                      type="text"
                      placeholder="10 or 8-12"
                      value={ex.reps}
                      onChange={(e) => updateExercise(i, 'reps', e.target.value)}
                    />
                  </div>
                  <div className="exercise-weight-block">
                    <label htmlFor={`create-exercise-weight-${i}`}>Weight — required</label>
                    <div className="weight-unit-toggle" role="group" aria-label="Weight unit">
                      <button
                        type="button"
                        className={`weight-unit-toggle__btn ${(ex.weightUnit || 'kg') === 'kg' ? 'active' : ''}`}
                        onClick={() => {
                          const cur = ex.weightUnit || 'kg';
                          if (cur === 'kg') return;
                          const w = convertWeightBetweenUnits(ex.weight, 'lb', 'kg');
                          patchExercise(i, { weight: w, weightUnit: 'kg' });
                        }}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        className={`weight-unit-toggle__btn ${(ex.weightUnit || 'kg') === 'lb' ? 'active' : ''}`}
                        onClick={() => {
                          const cur = ex.weightUnit || 'kg';
                          if (cur === 'lb') return;
                          const w = convertWeightBetweenUnits(ex.weight, 'kg', 'lb');
                          patchExercise(i, { weight: w, weightUnit: 'lb' });
                        }}
                      >
                        lb
                      </button>
                    </div>
                    <input
                      id={`create-exercise-weight-${i}`}
                      type="text"
                      placeholder={
                        (ex.weightUnit || 'kg') === 'lb'
                          ? 'e.g. 90, 0, or Bodyweight'
                          : 'e.g. 40, 0, or Bodyweight'
                      }
                      value={ex.weight === '0' || ex.weight === 0 ? '' : (ex.weight ?? '')}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = parseFloat(v);
                        if (v !== '' && !Number.isNaN(n) && n < 0) return;
                        updateExercise(i, 'weight', v);
                      }}
                    />
                  </div>
                </div>
              </div>
              );
            })}
            <button type="button" onClick={addExercise} className="add-exercise-btn add-exercise-btn--below-exercises">
              <FiPlus /> {mode === 'manual' ? 'Add Exercise Manually' : 'Add More'}
            </button>
          </div>

          <div className="create-workout-source-panel" aria-label="Add exercises from library or templates">
            <p className="create-workout-source-heading">Add exercises</p>
            <p className="create-workout-source-hint">
              Browse the library, use a template, or generate with AI — exercises appear in your list above.
            </p>
            <div className="create-mode-tabs create-mode-tabs--in-panel">
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mode-tab ${mode === m.id ? 'active' : ''}`}
                  onClick={() => setMode(m.id)}
                >
                  <m.icon /> {m.label}
                </button>
              ))}
            </div>

            {mode === 'library' && (
              <div className="library-section library-section--in-panel">
                <div className="library-search">
                  <div className="library-search-input-wrap">
                    <FiSearch className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search exercises..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    value={filterMuscle}
                    onChange={(e) => setFilterMuscle(e.target.value)}
                  >
                    <option value="All">{EXERCISE_LIBRARY_FILTER_LABELS.allMuscleGroups}</option>
                    {MUSCLE_GROUPS.map((mg) => (
                      <option key={mg} value={mg}>{mg}</option>
                    ))}
                  </select>
                  <select
                    value={filterEquipment}
                    onChange={(e) => setFilterEquipment(e.target.value)}
                  >
                    <option value="All">{EXERCISE_LIBRARY_FILTER_LABELS.allEquipment}</option>
                    {EQUIPMENT_TYPES.map((eq) => (
                      <option key={eq} value={eq}>{eq}</option>
                    ))}
                  </select>
                </div>
                <div className="library-list">
                  {filteredExercises.map((ex) => (
                    <button
                      key={`${ex.name}-${ex.muscleGroup}-${ex.equipment}`}
                      type="button"
                      className="library-item"
                      onClick={() => addFromLibrary(ex)}
                    >
                      <span className="lib-name">{ex.name}</span>
                      <span className="lib-muscle">{ex.muscleGroup}{ex.equipment ? ` • ${ex.equipment}` : ''}</span>
                      <FiPlus className="lib-add" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'template' && (
              <div className="template-section template-section--in-panel">
                {WORKOUT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="template-card"
                    onClick={() => applyTemplate(tpl)}
                  >
                    <h4>{tpl.name}</h4>
                    <p>{tpl.description}</p>
                    <span>{tpl.exercises.length} exercises</span>
                  </button>
                ))}
              </div>
            )}

            {mode === 'ai' && (
              <div className="ai-section ai-section--in-panel">
                <p>Select muscle groups for AI to generate a workout:</p>
                <div className="ai-muscle-chips">
                  {MUSCLE_GROUPS.map((mg) => (
                    <button
                      key={mg}
                      type="button"
                      className={`chip ${aiMuscleGroups.includes(mg) ? 'selected' : ''}`}
                      onClick={() => toggleAiMuscle(mg)}
                    >
                      {mg}
                    </button>
                  ))}
                </div>
                <button type="button" className="ai-generate-btn" onClick={generateAI}>
                  <FiZap /> Generate Workout
                </button>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="submit-btn create-continue-btn" disabled={loading}>
              Continue — visibility
            </button>
          </div>
        </form>
          </>
        )}

        {phase === 'visibility' && (
          <div className="create-visibility-step">
            <div className="create-visibility-summary">
              <span className="create-visibility-name">{formData.name || 'Your workout'}</span>
              <span className="create-visibility-count">{formData.exercises.length} exercises</span>
            </div>
            <p className="create-visibility-hint">Pick one — you can change this later when editing the workout.</p>
            <div className="visibility-choice-grid">
              <button
                type="button"
                className={`visibility-option-card visibility-public ${formData.isPublic ? 'selected' : ''}`}
                onClick={() => setFormData({ ...formData, isPublic: true })}
              >
                <span className="visibility-option-icon" aria-hidden>
                  <FiUsers size={28} />
                </span>
                <span className="visibility-option-label">Public</span>
                <span className="visibility-option-desc">
                  Show on the community feed — others can view and copy your split
                </span>
              </button>
              <button
                type="button"
                className={`visibility-option-card visibility-private ${!formData.isPublic ? 'selected' : ''}`}
                onClick={() => setFormData({ ...formData, isPublic: false })}
              >
                <span className="visibility-option-icon" aria-hidden>
                  <FiLock size={28} />
                </span>
                <span className="visibility-option-label">Private</span>
                <span className="visibility-option-desc">Only you see it on your dashboard</span>
              </button>
            </div>
            <div className="form-actions create-visibility-actions">
              <button
                type="button"
                className="cancel-btn"
                disabled={loading}
                onClick={() => setPhase('build')}
              >
                ← Back
              </button>
              <button
                type="button"
                className="submit-btn"
                disabled={loading}
                onClick={() => setPhase('schedule')}
              >
                Continue — training days
              </button>
            </div>
          </div>
        )}

        {phase === 'schedule' && (
          <div className="create-schedule-step">
            <div className="create-schedule-hero">
              <div className="create-schedule-hero-icon" aria-hidden>
                <FiCalendar size={24} />
              </div>
              <div>
                <h3>Schedule this split</h3>
                <p>
                  Tap each day you plan to do <strong>{formData.name || 'this workout'}</strong>. Leave all off to save
                  the template only (no email reminders for it until you assign days from edit).
                </p>
              </div>
            </div>

            <div className="create-schedule-day-grid" role="group" aria-label="Training days">
              {WEEKDAY_PICKER.map(({ d, short, full }) => {
                const on = trainingDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    className={`create-schedule-day-btn${on ? ' create-schedule-day-btn--on' : ''}`}
                    onClick={() => toggleTrainingDay(d)}
                    aria-pressed={on}
                    aria-label={`${full}${on ? ', selected' : ''}`}
                  >
                    <span className="dow-full">{short}</span>
                  </button>
                );
              })}
            </div>

            <p className="create-schedule-footnote">
              {trainingDays.length > 0 ? (
                <>
                  <strong>{trainingDays.length}</strong> training day{trainingDays.length === 1 ? '' : 's'} selected.
                  Reminder emails (if enabled in Profile) go out once in the morning on those days, in your time zone.
                </>
              ) : (
                <>No days selected — we&apos;ll only save the workout. You can assign days later by editing it.</>
              )}
            </p>

            <div className="form-actions create-visibility-actions">
              <button type="button" className="cancel-btn" disabled={loading} onClick={() => setPhase('visibility')}>
                ← Back
              </button>
              <button type="button" className="submit-btn" disabled={loading} onClick={handleFinalCreate}>
                {loading
                  ? 'Saving...'
                  : trainingDays.length > 0
                    ? `Create & schedule (${trainingDays.length} day${trainingDays.length === 1 ? '' : 's'})`
                    : 'Create workout'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateWorkout;
