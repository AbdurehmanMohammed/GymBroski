import React, { useState, useMemo } from 'react';
import { FiX, FiPlus, FiMinus, FiSearch, FiZap, FiLayers, FiLock, FiUsers } from 'react-icons/fi';
import { workoutAPI } from '../services/api';
import {
  EXERCISE_LIBRARY,
  WORKOUT_TEMPLATES,
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  filterExercisesByNameQuery,
} from '../data/exerciseLibrary';
import { getExerciseDemoVideoUrl } from '../utils/exerciseDemoVideo';

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
          muscleGroup: lib.muscleGroup,
        });
      }
    });
  });
  return exercises;
}

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
  /** After building the workout, user chooses Public vs Private before save */
  const [phase, setPhase] = useState('build'); // 'build' | 'visibility'
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
        { name: '', sets: 3, reps: '10', weight: '', muscleGroup: 'Other' },
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
    const emptyName = formData.exercises.some((ex) => !String(ex.name || '').trim());
    if (emptyName) {
      setError('Every exercise needs a name');
      return;
    }
    if (formData.exercises.some((ex) => !isExerciseWeightProvided(ex))) {
      setError('Every exercise needs a weight. Enter kg (e.g. 40), 0 if you use no added weight, or Bodyweight.');
      return;
    }
    setError('');
    setPhase('visibility');
  };

  const createPayload = () => ({
    ...formData,
    exercises: formData.exercises.map((ex) => ({
      name: ex.name,
      sets: Number(ex.sets) || 3,
      reps: String(ex.reps ?? 10),
      weight: String(ex.weight === '' || ex.weight === '0' || ex.weight == null ? '0' : ex.weight),
      muscleGroup: ex.muscleGroup || 'Other',
      videoUrl: getExerciseDemoVideoUrl(ex.name),
    })),
  });

  const handleFinalCreate = async () => {
    setLoading(true);
    setError('');
    try {
      await workoutAPI.create(createPayload());
      onSuccess();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to create workout');
    } finally {
      setLoading(false);
    }
  };

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
            <h2>{phase === 'visibility' ? 'Who can see this workout?' : 'Create Workout Split'}</h2>
            {phase === 'visibility' && (
              <p className="create-workout-subtitle">
                One last step — share with the community or keep it to yourself.
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
        <div className="create-mode-tabs">
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

        {/* Exercise Library */}
        {mode === 'library' && (
          <div className="library-section">
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
                <option value="All">All muscle groups</option>
                {MUSCLE_GROUPS.map((mg) => (
                  <option key={mg} value={mg}>{mg}</option>
                ))}
              </select>
              <select
                value={filterEquipment}
                onChange={(e) => setFilterEquipment(e.target.value)}
              >
                <option value="All">All equipment</option>
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

        {/* Templates */}
        {mode === 'template' && (
          <div className="template-section">
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

        {/* AI Workout */}
        {mode === 'ai' && (
          <div className="ai-section">
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

        {/* Manual add */}
        {mode === 'manual' && (
          <button type="button" onClick={addExercise} className="add-exercise-btn">
            <FiPlus /> Add Exercise Manually
          </button>
        )}

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
                  <div>
                    <label>Weight (kg) — required</label>
                    <input
                      type="text"
                      placeholder="e.g. 40, 0, or Bodyweight"
                      value={ex.weight === '0' || ex.weight === 0 ? '' : (ex.weight ?? '')}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = parseFloat(v);
                        if (v !== '' && !Number.isNaN(n) && n < 0) return;
                        updateExercise(i, 'weight', v);
                      }}
                      aria-invalid={!isExerciseWeightProvided(ex)}
                    />
                  </div>
                </div>
              </div>
              );
            })}
            {(mode === 'library' || mode === 'template' || mode === 'ai') && (
              <button type="button" onClick={addExercise} className="add-exercise-btn">
                <FiPlus /> Add More
              </button>
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
                onClick={handleFinalCreate}
              >
                {loading ? 'Creating...' : `Create ${formData.isPublic ? 'public' : 'private'} workout`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateWorkout;
