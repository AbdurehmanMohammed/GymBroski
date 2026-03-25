import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { 
  FiPlusCircle, 
  FiCalendar, 
  FiTrendingUp, 
  FiUser, 
  FiLogOut,
  FiEye,
  FiEdit,
  FiTrash2,
  FiGlobe,
  FiActivity,
  FiPlay,
  FiMenu,
  FiX,
  FiAward,
  FiClock
} from 'react-icons/fi';
import { workoutAPI, workoutSessionsAPI } from '../services/api';
import CreateWorkout from './CreateWorkout';
import EditWorkout from './EditWorkout';
import ActiveWorkoutSession from './ActiveWorkoutSession';
import ThemeToggle from './ThemeToggle';
import { resolveExerciseVideoUrl } from '../utils/exerciseDemoVideo';
import { ExerciseVideoInfoIcon, ExerciseVideoHelpModal } from './ExerciseVideoHelp';

const formatDuration = (seconds) => {
  if (seconds < 60) return `${seconds}sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}min ${s}sec` : `${m}min`;
};

/** Max history cards before requiring "Show all history" */
const WORKOUT_HISTORY_PREVIEW_LIMIT = 5;

const Dashboard = ({ theme = 'light', onToggleTheme }) => {
  const [workouts, setWorkouts] = useState([]);
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showActiveSession, setShowActiveSession] = useState(false);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exerciseVideoHelp, setExerciseVideoHelp] = useState(null);
  const [showAllWorkoutHistory, setShowAllWorkoutHistory] = useState(false);
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);
  const navTo = (path) => {
    navigate(path);
    closeMenu();
  };

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkoutHistory = async () => {
    try {
      const data = await workoutSessionsAPI.getAll();
      setWorkoutHistory(data);
    } catch (err) {
      console.error('Failed to fetch workout history:', err);
      setWorkoutHistory([]);
      if (err.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    }
  };

  useEffect(() => {
    fetchWorkoutHistory();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const response = await workoutAPI.getAll();
      setWorkouts(response);
    } catch (error) {
      console.error('Error fetching workouts:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    }
  };

  const handleView = (workout) => {
    setSelectedWorkout(workout);
    setShowViewModal(true);
  };

  const handleEdit = (workout) => {
    setSelectedWorkout(workout);
    setShowEditForm(true);
  };

  const handleStartWorkout = (workout) => {
    setSelectedWorkout(workout);
    setShowActiveSession(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this workout?')) {
      try {
        await workoutAPI.delete(id);
        fetchWorkouts();
      } catch (error) {
        console.error('Error deleting workout:', error);
        alert('Failed to delete workout');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
    window.location.reload();
  };

  return (
    <div className="dashboard">
      <div
        className={`mobile-menu-overlay ${menuOpen ? 'show' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />
      <div className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <button type="button" className="sidebar-close-btn" onClick={closeMenu} aria-label="Close menu">
          <FiX size={22} />
        </button>
        <div className="logo">
          <BrandLogo />
        </div>
        <div className="toggle-sidebar">
          <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} variant="sidebar" />
        </div>
        <nav>
          <button type="button" className="nav-btn active">
            <FiCalendar /> My Workouts
          </button>
          <button type="button" className="nav-btn" onClick={() => navTo('/community')}>
            <FiGlobe /> Community Feed
          </button>
          <button type="button" className="nav-btn" onClick={() => navTo('/progress')}>
            <FiTrendingUp /> Progress
          </button>
          <button type="button" className="nav-btn" onClick={() => navTo('/challenges')}>
            <FiAward /> Challenges
          </button>
          <button type="button" className="nav-btn" onClick={() => navTo('/tracking')}>
            <FiActivity /> Tracking
          </button>
          <button type="button" className="nav-btn" onClick={() => navTo('/profile')}>
            <FiUser /> Profile
          </button>
        </nav>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          <FiLogOut /> Logout
        </button>
      </div>

      <div className="main-content">
        <header>
          <button type="button" className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <FiMenu size={24} />
          </button>
          <div className="toggle-mobile">
            <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} variant="header" />
          </div>
          <h1>My Workout Splits</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              className="create-btn"
              onClick={() => setShowCreateForm(true)}
            >
              <FiPlusCircle /> Create New Split
            </button>
          </div>
        </header>

        {/* Workout Grid */}
        <div className="workouts-grid">
          {workouts.length === 0 ? (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-label)' }}>
              No workouts yet. Create your first workout split!
            </p>
          ) : (
            workouts.map(workout => (
              <div key={workout._id} className="workout-card">
                <div className="card-header">
                  <h3>{workout.name}</h3>
                  <span className={`visibility ${workout.isPublic ? 'public' : 'private'}`}>
                    {workout.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                {workout.copiedFrom && (
                  <p className="copied-from">Copied from <strong>{workout.copiedFrom}</strong></p>
                )}
                <p className="description">{workout.description || 'No description'}</p>
                
                <div className="exercises-preview">
                  <h4>Exercises:</h4>
                  {workout.exercises && workout.exercises.length > 0 ? (
                    <>
                      {workout.exercises.slice(0, 3).map((ex, index) => (
                        <div key={index} className="exercise-item">
                          <div className="exercise-item-left">
                            <span className="exercise-item-name">{ex.name}</span>
                            <ExerciseVideoInfoIcon
                              size={15}
                              onClick={() =>
                                setExerciseVideoHelp({
                                  name: ex.name,
                                  url: resolveExerciseVideoUrl(ex),
                                })
                              }
                            />
                          </div>
                          <span className="exercise-item-meta">
                            {ex.sets} sets × {ex.reps} reps
                          </span>
                        </div>
                      ))}
                      {workout.exercises.length > 3 && (
                        <div className="more-exercises">
                          +{workout.exercises.length - 3} more exercises
                        </div>
                      )}
                    </>
                  ) : (
                    <p style={{ color: 'var(--text-label)', fontSize: '14px' }}>No exercises added</p>
                  )}
                </div>

                <div className="card-actions">
                  <button 
                    className="action-btn start"
                    onClick={() => handleStartWorkout(workout)}
                  >
                    <FiPlay /> Start
                  </button>
                  <button 
                    className="action-btn view"
                    onClick={() => handleView(workout)}
                  >
                    <FiEye /> View
                  </button>
                  <button 
                    className="action-btn edit"
                    onClick={() => handleEdit(workout)}
                  >
                    <FiEdit /> Edit
                  </button>
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDelete(workout._id)}
                  >
                    <FiTrash2 /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Workout History */}
        <section className="workout-history-section">
          <div className="workout-history-header">
            <h2 className="workout-history-title">
              <FiClock /> History
            </h2>
            {workoutHistory.length > 0 && (
              <button
                type="button"
                className="workout-history-clear-btn"
                onClick={async () => {
                  if (!window.confirm('Delete all workout history? This cannot be undone.')) return;
                  try {
                    await workoutSessionsAPI.deleteAll();
                    setWorkoutHistory([]);
                  } catch (err) {
                    console.error('Failed to delete history:', err);
                    alert('Failed to delete history');
                  }
                }}
              >
                <FiTrash2 size={16} /> Clear history
              </button>
            )}
          </div>
          {workoutHistory.length === 0 ? (
            <p className="workout-history-empty">
              No completed workouts yet. Start a workout and finish it to see your history here.
            </p>
          ) : (
            <>
            <div className="workout-history-list">
              {(showAllWorkoutHistory
                ? workoutHistory
                : workoutHistory.slice(0, WORKOUT_HISTORY_PREVIEW_LIMIT)
              ).map((entry) => (
                <div
                  key={entry._id || `${entry.dateISO}-${entry.workoutName}`}
                  className="workout-history-card"
                  onClick={() => setSelectedHistoryEntry(entry)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedHistoryEntry(entry)}
                >
                  <div className="workout-history-card-header">
                    <h3>{entry.workoutName}</h3>
                    <span className="workout-history-date">{entry.dateStr}</span>
                  </div>
                  <div
                    className="workout-history-stats"
                    role="group"
                    aria-label="Session time and training volume"
                  >
                    <div className="workout-history-stat">
                      <span
                        className="workout-history-stat-label"
                        title="Time from your first completed set to your last completed set in this session."
                      >
                        Session time
                      </span>
                      <span className="workout-history-stat-value">
                        <FiClock size={14} aria-hidden />
                        {formatDuration(entry.durationSec)}
                      </span>
                    </div>
                    <div className="workout-history-stat">
                      <span
                        className="workout-history-stat-label"
                        title="Sum of (weight × reps) for every set you logged. 0 if you used bodyweight or did not enter weight."
                      >
                        Volume
                      </span>
                      <span className="workout-history-stat-value">
                        <span aria-hidden>🏋</span>
                        {entry.totalVolume?.toLocaleString() || 0} kg
                      </span>
                    </div>
                  </div>
                  {entry.exerciseBreakdown?.length > 0 && (
                    <div className="workout-history-exercises">
                      <p className="workout-history-ex-heading">Exercises in this session</p>
                      <div className="workout-history-ex-tags">
                        {entry.exerciseBreakdown
                          .filter((row) => row.setsCount > 0)
                          .slice(0, 4)
                          .map((row, i) => (
                            <span key={i} className="workout-history-ex-tag">
                              {row.setsCount}× {row.name}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {workoutHistory.length > WORKOUT_HISTORY_PREVIEW_LIMIT && (
              <button
                type="button"
                className="workout-history-show-all-btn"
                onClick={() => setShowAllWorkoutHistory((v) => !v)}
                aria-expanded={showAllWorkoutHistory}
              >
                {showAllWorkoutHistory
                  ? 'Show less'
                  : `Show all history (${workoutHistory.length - WORKOUT_HISTORY_PREVIEW_LIMIT} more)`}
              </button>
            )}
            </>
          )}
        </section>
      </div>

      {/* Create Workout Modal */}
      {showCreateForm && (
        <CreateWorkout 
          onClose={() => setShowCreateForm(false)}
          onSuccess={fetchWorkouts}
        />
      )}

      {/* Edit Workout Modal */}
      {showEditForm && selectedWorkout && (
        <EditWorkout 
          workout={selectedWorkout}
          onClose={() => {
            setShowEditForm(false);
            setSelectedWorkout(null);
          }}
          onSuccess={fetchWorkouts}
        />
      )}

      {showActiveSession && selectedWorkout && (
        <ActiveWorkoutSession
          workout={selectedWorkout}
          theme={theme}
          onClose={() => {
            setShowActiveSession(false);
            setSelectedWorkout(null);
          }}
          onFinish={() => {
            setShowActiveSession(false);
            setSelectedWorkout(null);
            fetchWorkoutHistory();
          }}
        />
      )}

      {/* View Workout Modal */}
      {showViewModal && selectedWorkout && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedWorkout.name}</h2>
              <button onClick={() => setShowViewModal(false)} className="close-btn" type="button">
                <FiX />
              </button>
            </div>
            
            <div className="view-modal-body">
              {selectedWorkout.copiedFrom && (
                <div className="view-modal-section">
                  <h4 className="view-modal-label">Copied from</h4>
                  <p className="view-modal-text"><strong>{selectedWorkout.copiedFrom}</strong></p>
                </div>
              )}
              <div className="view-modal-section">
                <h4 className="view-modal-label">Description</h4>
                <p className="view-modal-text">{selectedWorkout.description || 'No description'}</p>
              </div>

              <div className="view-modal-section">
                <h4 className="view-modal-label">Visibility</h4>
                <span className={`visibility ${selectedWorkout.isPublic ? 'public' : 'private'}`}>
                  {selectedWorkout.isPublic ? 'Public' : 'Private'}
                </span>
              </div>

              <div className="view-modal-section">
                <h4 className="view-modal-label">Exercises ({selectedWorkout.exercises.length})</h4>
                {selectedWorkout.exercises.map((ex, index) => (
                  <div key={index} className="view-modal-exercise">
                    <div className="view-modal-exercise-name-row">
                      <h5 className="view-modal-exercise-name">{ex.name}</h5>
                      <ExerciseVideoInfoIcon
                        size={16}
                        onClick={() =>
                          setExerciseVideoHelp({
                            name: ex.name,
                            url: resolveExerciseVideoUrl(ex),
                          })
                        }
                      />
                    </div>
                    <div className="view-modal-exercise-details">
                      <span><strong>Sets:</strong> {ex.sets}</span>
                      <span><strong>Reps:</strong> {ex.reps}</span>
                      <span><strong>Weight:</strong> {ex.weight} kg</span>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setShowViewModal(false)}
                className="view-modal-close-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workout History Detail Modal */}
      {selectedHistoryEntry && (
        <div
          className="modal-overlay history-detail-overlay"
          onClick={() => setSelectedHistoryEntry(null)}
        >
          <div
            className="workout-history-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="summary-close-btn"
              onClick={() => setSelectedHistoryEntry(null)}
              aria-label="Close"
            >
              <FiX size={24} />
            </button>
            <div className="summary-congrats summary-congrats--history">
              <div className="summary-stars">★★★</div>
              <h2 className="summary-title">Workout Summary</h2>
              <p className="summary-count">{selectedHistoryEntry.workoutName}</p>
            </div>
            <div className="summary-card">
              <h3 className="summary-card-title">{selectedHistoryEntry.workoutName}</h3>
              <p className="summary-card-date">{selectedHistoryEntry.dateStr}</p>
              <div className="summary-stats">
                <span className="summary-stat summary-stat--labeled">
                  <span className="summary-stat-label">Session time</span>
                  <span className="summary-stat-row">
                    <span className="summary-stat-icon">⏱</span>
                    {formatDuration(selectedHistoryEntry.durationSec)}
                  </span>
                </span>
                <span className="summary-stat summary-stat--labeled">
                  <span className="summary-stat-label">Volume</span>
                  <span className="summary-stat-row">
                    <span className="summary-stat-icon">🏋</span>
                    {(selectedHistoryEntry.totalVolume || 0).toLocaleString()} kg
                  </span>
                </span>
                <span
                  className="summary-stat summary-stat--labeled"
                  title="Personal records earned in this workout. Beat your previous best to earn PRs!"
                >
                  <span className="summary-stat-label">PRs</span>
                  <span className="summary-stat-row">
                    <FiAward size={18} className="summary-stat-icon" />
                    {(selectedHistoryEntry.prs?.length ?? 0) > 0
                      ? `${selectedHistoryEntry.prs.length} PR${selectedHistoryEntry.prs.length > 1 ? 's' : ''}`
                      : 'No PRs'}
                  </span>
                </span>
              </div>
              {(selectedHistoryEntry.prs?.length ?? 0) === 0 && (
                <p className="summary-pr-hint">Beat your previous best weight/reps to earn PRs.</p>
              )}
              <div className="summary-exercises">
                <div className="summary-ex-row header">
                  <span>Exercise</span>
                  <span>Best Set</span>
                  <span>Duration</span>
                </div>
                {(selectedHistoryEntry.exerciseBreakdown || [])
                  .filter((row) => row.setsCount > 0)
                  .map((row, i) => {
                    const isPR = (selectedHistoryEntry.prs || []).some((p) =>
                      p.exerciseName?.toLowerCase() === row.name?.toLowerCase()
                    );
                    return (
                      <div key={i} className="summary-ex-row">
                        <span>
                          {row.setsCount} × {row.name}
                          {isPR && <span className="summary-pr-badge" title="Personal Record"> 🏆</span>}
                        </span>
                        <span>{row.bestSet}</span>
                        <span className="summary-ex-duration">
                          {row.durationSec > 0 ? formatDuration(row.durationSec) : '—'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
            <div className="workout-history-modal-actions">
              <button
                type="button"
                className="workout-history-delete-btn"
                onClick={async () => {
                  if (!selectedHistoryEntry?._id) return;
                  if (!window.confirm('Delete this workout from history?')) return;
                  try {
                    await workoutSessionsAPI.delete(selectedHistoryEntry._id);
                    setWorkoutHistory((prev) => prev.filter((e) => e._id !== selectedHistoryEntry._id));
                    setSelectedHistoryEntry(null);
                  } catch (err) {
                    console.error('Failed to delete:', err);
                    alert('Failed to delete');
                  }
                }}
              >
                <FiTrash2 size={16} /> Delete
              </button>
              <button
                type="button"
                className="summary-done-btn"
                onClick={() => setSelectedHistoryEntry(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      <ExerciseVideoHelpModal
        open={!!exerciseVideoHelp}
        exerciseName={exerciseVideoHelp?.name}
        videoUrl={exerciseVideoHelp?.url}
        onClose={() => setExerciseVideoHelp(null)}
      />
    </div>
  );
};

export default Dashboard;