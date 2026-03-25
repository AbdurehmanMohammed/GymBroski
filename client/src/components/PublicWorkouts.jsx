import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { 
  FiCalendar, 
  FiTrendingUp, 
  FiUser, 
  FiLogOut,
  FiEye,
  FiCopy,
  FiGlobe,
  FiActivity,
  FiMenu,
  FiX,
  FiAward,
  FiMessageCircle,
  FiGrid,
  FiSearch
} from 'react-icons/fi';
import { workoutsAPI } from '../services/api';
import { useChatUnread } from '../hooks/useChatUnread';
import CommunityChat from './CommunityChat';
import ThemeToggle from './ThemeToggle';
import { resolveExerciseVideoUrl } from '../utils/exerciseDemoVideo';
import { ExerciseVideoInfoIcon, ExerciseVideoHelpModal } from './ExerciseVideoHelp';

const PublicWorkouts = ({ theme = 'light', onToggleTheme }) => {
  const [publicWorkouts, setPublicWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatWithUser, setChatWithUser] = useState(null);
  const [communityTab, setCommunityTab] = useState('workouts'); // 'workouts' | 'chat'
  const [searchQuery, setSearchQuery] = useState('');
  const [exerciseVideoHelp, setExerciseVideoHelp] = useState(null);
  const chatUnread = useChatUnread();
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const closeMenu = () => setMenuOpen(false);
  const navTo = (path) => {
    navigate(path);
    closeMenu();
  };

  useEffect(() => {
    fetchPublicWorkouts();
  }, []);

  const fetchPublicWorkouts = async () => {
    try {
      setLoading(true);
      const response = await workoutsAPI.getCommunity();
      setPublicWorkouts(response);
    } catch (error) {
      console.error('Error fetching public workouts:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
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
      const creatorName = workout.userId?.name || 'Unknown';
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
          muscleGroup: ex.muscleGroup || 'Other',
          videoUrl: resolveExerciseVideoUrl(ex),
        })),
      };

      await workoutsAPI.create(workoutCopy);
      alert('Workout copied to your collection!');
    } catch (error) {
      console.error('Error copying workout:', error);
      alert('Failed to copy workout');
    }
  };

  const filteredWorkouts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return publicWorkouts;
    return publicWorkouts.filter((w) => {
      const name = (w.name || '').toLowerCase();
      const desc = (w.description || '').toLowerCase();
      const creator = (w.userId?.name || '').toLowerCase();
      const exercises = (w.exercises || []).map((e) => (e.name || '').toLowerCase()).join(' ');
      return name.includes(q) || desc.includes(q) || creator.includes(q) || exercises.includes(q);
    });
  }, [publicWorkouts, searchQuery]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
    window.location.reload();
  };

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
          <button type="button" className="nav-btn active" onClick={closeMenu}>
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>Community Feed</h1>
            <div className="community-sub-tabs">
              <button
                type="button"
                className={`community-sub-tab ${communityTab === 'workouts' ? 'active' : ''}`}
                onClick={() => setCommunityTab('workouts')}
              >
                <FiGrid size={16} /> Workouts
              </button>
              <button
                type="button"
                className={`community-sub-tab community-sub-tab-chat ${communityTab === 'chat' ? 'active' : ''}`}
                onClick={() => setCommunityTab('chat')}
              >
                <FiMessageCircle size={16} /> Chat
                {chatUnread > 0 && (
                  <span className="community-unread-badge">{chatUnread > 99 ? '99+' : chatUnread}</span>
                )}
              </button>
            </div>
          </div>
        </header>

        {communityTab === 'workouts' && (
        <>
        <div className="community-search-wrap">
          <FiSearch size={18} className="community-search-icon" />
          <input
            type="text"
            className="community-search-input"
            placeholder="Search workouts, exercises, or creators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {/* Loading State */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-label)' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid #e2e8f0',
              borderTop: '4px solid #667eea',
              borderRadius: '50%',
              margin: '0 auto 20px',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p>Loading community workouts...</p>
          </div>
        ) : (
          /* Workout Grid */
          <div className="workouts-grid">
            {filteredWorkouts.length === 0 ? (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-label)' }}>
                {publicWorkouts.length === 0
                  ? 'No public workouts available yet. Be the first to share!'
                  : 'No workouts match your search.'}
              </p>
            ) : (
              filteredWorkouts.map(workout => (
                <div key={workout._id} className="workout-card">
                  <div className="card-header">
                    <h3>{workout.name}</h3>
                    <span className="visibility public">Public</span>
                  </div>

                  {/* Creator Info - profile image + name, clickable to profile */}
                  <button
                    type="button"
                    onClick={() => workout.userId?._id && navigate(`/profile/${workout.userId._id}`)}
                    disabled={!workout.userId?._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '12px',
                      padding: '8px 10px',
                      background: 'var(--bg-secondary, #f8f9fa)',
                      borderRadius: '8px',
                      border: 'none',
                      width: '100%',
                      cursor: workout.userId?._id ? 'pointer' : 'default',
                      textAlign: 'left'
                    }}
                  >
                    {workout.userId?.profilePhoto ? (
                      <img
                        src={workout.userId.profilePhoto}
                        alt=""
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid var(--primary, #667eea)',
                          flexShrink: 0
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--primary, #667eea)',
                      display: workout.userId?.profilePhoto ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'white',
                      flexShrink: 0
                    }}>
                      {(workout.userId?.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                      by <strong style={{ color: workout.userId?._id ? 'var(--primary, #667eea)' : 'var(--text)' }}>
                        {workout.userId?.name || 'Anonymous'}
                      </strong>
                    </span>
                  </button>

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
                      className="action-btn view"
                      onClick={() => handleView(workout)}
                    >
                      <FiEye /> View
                    </button>
                    <button 
                      className="action-btn copy"
                      onClick={() => handleCopyWorkout(workout)}
                    >
                      <FiCopy /> Copy
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        </>
        )}

        {communityTab === 'chat' && (
          <section className="community-chat-page">
            <div className="community-chat-wrapper community-chat-full">
              <CommunityChat
                currentUser={currentUser}
                initialChatWithUser={chatWithUser}
              />
            </div>
          </section>
        )}
      </div>

      {/* View Workout Modal */}
      {showViewModal && selectedWorkout && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedWorkout.name}</h2>
              <button onClick={() => setShowViewModal(false)} className="close-btn" type="button" aria-label="Close">
                <FiX size={22} />
              </button>
            </div>
            
            <div className="view-modal-body">
              {/* Creator Info */}
              <div className="view-modal-section">
                <h4 className="view-modal-label">Created by</h4>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {selectedWorkout.userId?.profilePhoto ? (
                      <img
                        src={selectedWorkout.userId.profilePhoto}
                        alt=""
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid var(--primary)',
                          flexShrink: 0
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      display: selectedWorkout.userId?.profilePhoto ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 600,
                      color: 'white',
                      flexShrink: 0
                    }}>
                      {(selectedWorkout.userId?.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>
                        {selectedWorkout.userId?.name || 'Anonymous'}
                      </p>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                        {selectedWorkout.userId?.email || 'No email'}
                      </p>
                    </div>
                  </div>
                  {selectedWorkout.userId?._id && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowViewModal(false);
                          setChatWithUser(selectedWorkout.userId);
                          setCommunityTab('chat');
                        }}
                        style={{
                          padding: '8px 14px',
                          background: '#eef2ff',
                          color: '#6366f1',
                          border: '2px solid #6366f1',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <FiMessageCircle size={14} /> Message
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowViewModal(false);
                          navigate(`/profile/${selectedWorkout.userId._id}`);
                        }}
                        style={{
                          padding: '8px 14px',
                          background: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <FiUser size={14} /> View profile
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="view-modal-section">
                <h4 className="view-modal-label">Description</h4>
                <p className="view-modal-text">{selectedWorkout.description || 'No description'}</p>
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

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button 
                  onClick={() => {
                    handleCopyWorkout(selectedWorkout);
                    setShowViewModal(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: '#e3f2fd',
                    color: '#1976d2',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <FiCopy /> Copy Workout
                </button>
                <button 
                  onClick={() => setShowViewModal(false)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
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

export default PublicWorkouts;
