import React, { useState } from 'react';
import { FiX, FiPlus, FiMinus, FiGlobe } from 'react-icons/fi';
import { workoutAPI } from '../services/api';
import { getExerciseDemoVideoUrl } from '../utils/exerciseDemoVideo';
import { filterExercisesByNameQuery } from '../data/exerciseLibrary';

const EditWorkout = ({ workout, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: workout.name,
    description: workout.description || '',
    isPublic: workout.isPublic,
    exercises: workout.exercises.length > 0 
      ? workout.exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight === 0 || ex.weight === '0' ? '' : (ex.weight ?? ''),
          muscleGroup: ex.muscleGroup || 'Other',
        }))
      : [{ name: '', sets: 3, reps: 10, weight: '', muscleGroup: 'Other' }]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nameSuggestRow, setNameSuggestRow] = useState(null);

  const isExerciseWeightProvided = (ex) => {
    const w = ex.weight;
    if (w == null) return false;
    return String(w).trim() !== '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.exercises.some((ex) => !isExerciseWeightProvided(ex))) {
      setError(
        'Every exercise needs a weight. Enter kg (e.g. 40), 0 if you use no added weight, or Bodyweight.'
      );
      return;
    }
    setLoading(true);

    const payload = {
      ...formData,
      exercises: formData.exercises.map((ex) => ({
        ...ex,
        weight: ex.weight === '' || ex.weight === '0' || ex.weight == null ? 0 : ex.weight,
        videoUrl: getExerciseDemoVideoUrl(ex.name),
      })),
    };

    try {
      await workoutAPI.update(workout._id, payload);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating workout:', err);
      setError(err.response?.data?.message || 'Failed to update workout');
    } finally {
      setLoading(false);
    }
  };

  const addExercise = () => {
    setFormData({
      ...formData,
      exercises: [...formData.exercises, { name: '', sets: 3, reps: 10, weight: '', muscleGroup: 'Other' }]
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
        reps: libEx.defaultReps,
        weight:
          libEx.defaultWeight && libEx.defaultWeight !== '0' ? libEx.defaultWeight : '',
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
                  <div>
                    <label>Weight (kg) — required</label>
                    <input
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
                      aria-invalid={!isExerciseWeightProvided(exercise)}
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
