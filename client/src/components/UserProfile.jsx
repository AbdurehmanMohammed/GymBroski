import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import {
  FiCalendar,
  FiTrendingUp,
  FiUser,
  FiLogOut,
  FiGlobe,
  FiActivity,
  FiMenu,
  FiX,
  FiEye,
  FiCopy,
  FiArrowLeft,
  FiAward,
  FiLayers,
  FiShield
} from 'react-icons/fi';
import { profileAPI, workoutsAPI, trackingAPI } from '../services/api';
import { isAdminUser } from '../utils/authRole';
import ThemeToggle from './ThemeToggle';
import { resolveExerciseVideoUrl } from '../utils/exerciseDemoVideo';
import { ExerciseVideoInfoIcon, ExerciseVideoHelpModal } from './ExerciseVideoHelp';
import LeaderboardRankBadge from './LeaderboardRankBadge';

const UserProfile = ({ theme = 'light', onToggleTheme }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [prs, setPRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [exerciseVideoHelp, setExerciseVideoHelp] = useState(null);

  const closeMenu = () => setMenuOpen(false);
  const navTo = (path) => {
    navigate(path);
    closeMenu();
  };

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profileRes, workoutsRes, prsRes] = await Promise.all([
        profileAPI.getPublicProfile(userId),
        workoutsAPI.getCommunityByUser(userId),
        trackingAPI.getPRByUser(userId).catch(() => [])
      ]);
      setProfile(profileRes);
      setWorkouts(workoutsRes);
      setPRs(Array.isArray(prsRes) ? prsRes : []);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError(err.message || 'User not found');
      setProfile(null);
      setWorkouts([]);
      setPRs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (workout) => {
    setSelectedWorkout(workout);
    setShowViewModal(true);
  };

  const handleCopyWorkout = async (workout) => {
    try {
      const creatorName = profile?.name || 'Unknown';
      const workoutCopy = {
        name: `${workout.name} (Copy)`,
        description: workout.description,
        isPublic: false,
        copiedFrom: creatorName,
        exercises: workout.exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          weightUnit: ex.weightUnit === 'kg' ? 'kg' : 'lb',
          muscleGroup: ex.muscleGroup || 'Other',
          videoUrl: resolveExerciseVideoUrl(ex),
        })),
      };
      await workoutsAPI.create(workoutCopy);
      alert('Workout copied to your collection!');
    } catch (err) {
      console.error('Error copying workout:', err);
      alert('Failed to copy workout');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
    window.location.reload();
  };

  const getInitials = () => {
    return profile?.name?.charAt(0).toUpperCase() || '?';
  };

  const memberSinceLabel = () => {
    const raw = profile?.createdAt;
    if (!raw) return null;
    try {
      return new Date(raw).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="main-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{
              width: '50px', height: '50px', border: '4px solid var(--border)',
              borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 20px',
              animation: 'spin 1s linear infinite'
            }} />
            <p>Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="dashboard">
        <div className="main-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>{error || 'User not found'}</p>
            <button
              type="button"
              className="action-btn view"
              onClick={() => navigate('/community')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <FiArrowLeft /> Back to Bruski's Feed
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className={`mobile-menu-overlay ${menuOpen ? 'show' : ''}`} onClick={closeMenu} aria-hidden="true" />
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
          <button type="button" className="nav-btn" onClick={() => navTo('/dashboard')}>
            <FiCalendar /> My Workouts
          </button>
          <button type="button" className="nav-btn" onClick={() => navTo('/community')}>
            <FiGlobe /> Bruski's Feed
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
          {isAdminUser() && (
            <button type="button" className="nav-btn" onClick={() => navTo('/admin')}>
              <FiShield /> Admin
            </button>
          )}
          <button type="button" className="nav-btn" onClick={() => navTo('/profile')}>
            <FiUser /> Profile
          </button>
        </nav>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          <FiLogOut /> Logout
        </button>
      </div>

      <div className="main-content user-profile-page">
        <header className="user-profile-toolbar">
          <div className="user-profile-toolbar__row">
            <button type="button" className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <FiMenu size={24} />
            </button>
            <button type="button" className="user-profile-back-btn" onClick={() => navigate('/community')}>
              <FiArrowLeft size={18} aria-hidden />
              Back to Bruski's Feed
            </button>
            <div className="toggle-mobile">
              <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} variant="header" />
            </div>
          </div>
        </header>

        <section className="user-profile-hero" aria-label="Profile summary">
          <div className="user-profile-avatar-wrap">
            <div className="user-profile-avatar-ring">
              {profile.profilePhoto ? (
                <img
                  src={profile.profilePhoto}
                  alt=""
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const fb = e.target.nextElementSibling;
                    if (fb) fb.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="user-profile-avatar-fallback"
                style={{ display: profile.profilePhoto ? 'none' : 'flex' }}
                aria-hidden
              >
                {getInitials()}
              </div>
            </div>
          </div>
          <div className="user-profile-hero-text">
            <h1 className="user-profile-display-name">{profile.name}</h1>
            {profile.leaderboardRank != null && profile.leaderboardTotalUsers != null && (
              <LeaderboardRankBadge rank={profile.leaderboardRank} totalUsers={profile.leaderboardTotalUsers} />
            )}
            <div className="user-profile-stats" role="list">
              <div className="user-profile-stat" role="listitem">
                <span className="user-profile-stat__value">{workouts.length}</span>
                <span className="user-profile-stat__label">Public workouts</span>
              </div>
              <div className="user-profile-stat" role="listitem">
                <span className="user-profile-stat__value">{prs.length}</span>
                <span className="user-profile-stat__label">PRs shown</span>
              </div>
              <div className="user-profile-stat" role="listitem">
                <span className="user-profile-stat__value">{profile.points ?? 0}</span>
                <span className="user-profile-stat__label">Challenge pts</span>
              </div>
            </div>
            {memberSinceLabel() && (
              <p className="user-profile-since">
                <FiCalendar size={16} aria-hidden />
                <span>Member since {memberSinceLabel()}</span>
              </p>
            )}
          </div>
        </section>

        <div className="user-profile-grid">
          <section className="user-profile-panel" aria-labelledby="user-profile-pr-heading">
            <div className="user-profile-panel__head">
              <span className="user-profile-panel__icon" aria-hidden>
                <FiAward size={18} />
              </span>
              <h2 id="user-profile-pr-heading">Personal records</h2>
            </div>
            {prs.length === 0 ? (
              <p className="user-profile-empty">No personal records yet.</p>
            ) : (
              <div>
                {prs.map((e) => (
                  <div key={e._id} className="user-profile-pr-item">
                    <div>
                      <strong>{e.exerciseName}</strong> — {e.weight} {e.unit || 'kg'} × {e.reps} reps
                    </div>
                    <span className="pr-date">{new Date(e.date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            className="user-profile-panel user-profile-panel--workouts"
            aria-labelledby="user-profile-workouts-heading"
          >
            <div className="user-profile-panel__head">
              <span className="user-profile-panel__icon" aria-hidden>
                <FiLayers size={18} />
              </span>
              <h2 id="user-profile-workouts-heading">Public workouts</h2>
            </div>
            {workouts.length === 0 ? (
              <p className="user-profile-empty">No public workouts yet.</p>
            ) : (
              <div className="user-profile-workouts-scroll-wrap">
                <div
                  className={`user-profile-workouts-scroll${workouts.length > 1 ? ' user-profile-workouts-scroll--has-multiple' : ''}`}
                  role="region"
                  aria-label="Public workouts list"
                  tabIndex={0}
                >
                  <div className="workouts-grid user-profile-workouts-grid">
                    {workouts.map((workout) => (
                      <div key={workout._id} className="workout-card">
                        <div className="card-header">
                          <h3>{workout.name}</h3>
                          <span className="visibility public">Public</span>
                        </div>
                        <p className="description">{workout.description || 'No description'}</p>
                        <div className="exercises-preview">
                          <h4>Exercises</h4>
                          {workout.exercises?.length > 0 ? (
                            <>
                              {workout.exercises.slice(0, 3).map((ex, i) => (
                                <div key={i} className="exercise-item">
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
                                <div className="more-exercises">+{workout.exercises.length - 3} more</div>
                              )}
                            </>
                          ) : (
                            <p style={{ color: 'var(--text-subtle)', fontSize: '15px' }}>No exercises</p>
                          )}
                        </div>
                        <div className="card-actions">
                          <button type="button" className="action-btn view" onClick={() => handleView(workout)}>
                            <FiEye /> View
                          </button>
                          <button type="button" className="action-btn copy" onClick={() => handleCopyWorkout(workout)}>
                            <FiCopy /> Copy
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {workouts.length > 1 && (
                  <p className="user-profile-workouts-scroll-hint" aria-live="polite">
                    <span className="user-profile-workouts-scroll-hint__icon" aria-hidden>
                      ↕
                    </span>
                    Scroll to see all {workouts.length} workouts
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {showViewModal && selectedWorkout && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedWorkout.name}</h2>
              <button type="button" onClick={() => setShowViewModal(false)} className="close-btn">
                <FiX size={22} />
              </button>
            </div>
            <div className="view-modal-body">
              <div className="view-modal-section">
                <h4 className="view-modal-label">Description</h4>
                <p className="view-modal-text">{selectedWorkout.description || 'No description'}</p>
              </div>
              <div className="view-modal-section">
                <h4 className="view-modal-label">Exercises ({selectedWorkout.exercises?.length || 0})</h4>
                {(selectedWorkout.exercises || []).map((ex, i) => (
                  <div key={i} className="view-modal-exercise">
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
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="action-btn copy"
                  style={{ flex: 1 }}
                  onClick={() => {
                    handleCopyWorkout(selectedWorkout);
                    setShowViewModal(false);
                  }}
                >
                  <FiCopy /> Copy Workout
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: 'var(--primary-gradient)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowViewModal(false)}
                >
                  Close
                </button>
              </div>
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

export default UserProfile;
