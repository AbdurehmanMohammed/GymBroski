import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  FiSearch,
  FiShield,
  FiHeart,
  FiSend,
  FiImage,
  FiClock,
  FiBarChart2,
  FiBell
} from 'react-icons/fi';
import { workoutsAPI, progressPhotosAPI, profileAPI } from '../services/api';
import { isAdminUser } from '../utils/authRole';
import { useChatUnread } from '../hooks/useChatUnread';
import CommunityChat from './CommunityChat';
import ThemeToggle from './ThemeToggle';
import { resolveExerciseVideoUrl } from '../utils/exerciseDemoVideo';
import { totalVolumeKgToLb } from '../utils/weightUnits';
import { ExerciseVideoInfoIcon, ExerciseVideoHelpModal } from './ExerciseVideoHelp';

const PublicWorkouts = ({ theme = 'light', onToggleTheme }) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserId = String(currentUser?._id || currentUser?.id || currentUser?.userId || '');
  const [publicWorkouts, setPublicWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatWithUser, setChatWithUser] = useState(null);
  const [communityTab, setCommunityTab] = useState('workouts'); // 'workouts' | 'chat'
  const [searchQuery, setSearchQuery] = useState('');
  const [exerciseVideoHelp, setExerciseVideoHelp] = useState(null);
  const [communityPhotos, setCommunityPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosHasMore, setPhotosHasMore] = useState(true);
  const [photosLoadingMore, setPhotosLoadingMore] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [emailCommunityPhotoNotifications, setEmailCommunityPhotoNotifications] = useState(
    currentUser?.emailCommunityPhotoNotifications !== false
  );
  const [photoEmailPrefSaving, setPhotoEmailPrefSaving] = useState(false);
  const chatUnread = useChatUnread();
  const navigate = useNavigate();
  const photosSentinelRef = useRef(null);
  const PHOTOS_PAGE_SIZE = 18;

  const closeMenu = () => setMenuOpen(false);
  const navTo = (path) => {
    navigate(path);
    closeMenu();
  };

  useEffect(() => {
    fetchPublicWorkouts();
    fetchCommunityPhotos({ reset: true });
  }, []);

  /** Server is source of truth — login payload may omit this flag. */
  useEffect(() => {
    let cancelled = false;
    profileAPI
      .getProfile()
      .then((p) => {
        if (cancelled || !p) return;
        const on = p.emailCommunityPhotoNotifications !== false;
        setEmailCommunityPhotoNotifications(on);
        try {
          const raw = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem(
            'user',
            JSON.stringify({ ...raw, emailCommunityPhotoNotifications: on })
          );
        } catch (_) {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
          weightUnit: ex.weightUnit === 'kg' ? 'kg' : 'lb',
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

  const formatRelativeTime = (dateString) => {
    const d = new Date(dateString);
    const sec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
  };

  const formatDuration = (durationSec) => {
    const s = Math.max(0, Number(durationSec) || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const fetchCommunityPhotos = useCallback(async ({ reset = false } = {}) => {
    if (!reset && (!photosHasMore || photosLoadingMore || photosLoading)) return;
    try {
      if (reset) {
        setPhotosLoading(true);
      } else {
        setPhotosLoadingMore(true);
      }
      const skip = reset ? 0 : communityPhotos.length;
      const data = await progressPhotosAPI.getCommunity({ limit: PHOTOS_PAGE_SIZE, skip });
      const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
      const hasMore = Array.isArray(data) ? items.length === PHOTOS_PAGE_SIZE : !!data.hasMore;
      setCommunityPhotos((prev) => (reset ? items : [...prev, ...items]));
      setPhotosHasMore(hasMore);
    } catch (e) {
      console.error('Error fetching community photos:', e);
      if (reset) setCommunityPhotos([]);
      setPhotosHasMore(false);
    } finally {
      setPhotosLoading(false);
      setPhotosLoadingMore(false);
    }
  }, [PHOTOS_PAGE_SIZE, communityPhotos.length, photosHasMore, photosLoading, photosLoadingMore]);

  useEffect(() => {
    if (communityTab !== 'photos' || !photosHasMore) return;
    const node = photosSentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchCommunityPhotos();
      },
      { rootMargin: '220px 0px' }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [communityTab, photosHasMore, fetchCommunityPhotos]);

  const toggleLike = async (postId) => {
    try {
      const res = await progressPhotosAPI.toggleCommunityLike(postId);
      setCommunityPhotos((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, likedByMe: !!res.likedByMe, likesCount: Number(res.likesCount) || 0 } : p
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  const addComment = async (postId) => {
    const draft = String(commentDrafts[postId] || '').trim();
    if (!draft) return;
    try {
      const comment = await progressPhotosAPI.addCommunityComment(postId, draft);
      setCommunityPhotos((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p))
      );
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    } catch (e) {
      alert(e.message || 'Failed to comment');
    }
  };

  const handleDeleteCommunityPost = async (postId) => {
    setDeletingPostId(postId);
    try {
      await progressPhotosAPI.deleteCommunityPost(postId);
      setCommunityPhotos((prev) => prev.filter((p) => p._id !== postId));
    } catch (e) {
      alert(e.message || 'Failed to delete post');
    } finally {
      setDeletingPostId('');
    }
  };

  const toggleCommunityPhotoEmails = async () => {
    if (photoEmailPrefSaving) return;
    const next = !emailCommunityPhotoNotifications;
    setEmailCommunityPhotoNotifications(next);
    setPhotoEmailPrefSaving(true);
    try {
      const updated = await profileAPI.updateProfile({ emailCommunityPhotoNotifications: next });
      const on = updated.emailCommunityPhotoNotifications !== false;
      setEmailCommunityPhotoNotifications(on);
      try {
        const raw = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem(
          'user',
          JSON.stringify({
            ...raw,
            emailCommunityPhotoNotifications: on,
          })
        );
      } catch (_) {
        /* ignore */
      }
    } catch (e) {
      setEmailCommunityPhotoNotifications((v) => !v);
      alert(e.message || 'Failed to update email setting');
    } finally {
      setPhotoEmailPrefSaving(false);
    }
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

      <div className="main-content community-feed-layout">
        <header>
          <button type="button" className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <FiMenu size={24} />
          </button>
          <div className="toggle-mobile">
            <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} variant="header" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>Bruski's Feed</h1>
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
              <button
                type="button"
                className={`community-sub-tab ${communityTab === 'photos' ? 'active' : ''}`}
                onClick={() => setCommunityTab('photos')}
              >
                <FiImage size={16} /> Bruski's photos
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
                    className="workout-card-creator-btn"
                    onClick={() => workout.userId?._id && navigate(`/profile/${workout.userId._id}`)}
                    disabled={!workout.userId?._id}
                  >
                    {workout.userId?.profilePhoto ? (
                      <img
                        src={workout.userId.profilePhoto}
                        alt=""
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className="workout-card-creator-btn__avatar-fallback"
                      style={{ display: workout.userId?.profilePhoto ? 'none' : 'flex' }}
                    >
                      {(workout.userId?.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="workout-card-creator-btn__byline">
                      <span className="workout-card-creator-btn__by">by </span>
                      <span className="workout-card-creator-btn__name">
                        {workout.userId?.name || 'Anonymous'}
                      </span>
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
          <>
            {/* Same vertical offset as Workouts tab (search row) so layout does not jump when switching */}
            <div className="community-chat-tab-spacer" aria-hidden />
            <section className="community-chat-page">
            <div className="community-chat-wrapper community-chat-full">
              <CommunityChat
                currentUser={currentUser}
                initialChatWithUser={chatWithUser}
              />
            </div>
          </section>
          </>
        )}

        {communityTab === 'photos' && (
          <section className="community-photos-tab">
            <div className="community-photos-toolbar">
              <button
                type="button"
                className={`community-photo-email-toggle ${emailCommunityPhotoNotifications ? 'on' : 'off'}`}
                onClick={toggleCommunityPhotoEmails}
                disabled={photoEmailPrefSaving}
                aria-pressed={emailCommunityPhotoNotifications}
                aria-busy={photoEmailPrefSaving}
                title={
                  emailCommunityPhotoNotifications
                    ? "You get an email when someone posts to Bruski's photos. Click to turn off."
                    : "Turn on to get an email when someone posts to Bruski's photos."
                }
              >
                <FiBell aria-hidden />
                {photoEmailPrefSaving
                  ? 'Saving…'
                  : emailCommunityPhotoNotifications
                    ? 'Photo emails: on'
                    : 'Photo emails: off'}
              </button>
            </div>
            <p className="community-photos-expire-hint">Posts auto-expire after 48 hours. To share a photo, finish a workout and use the prompt after your summary.</p>
            {photosLoading ? (
              <p className="community-photos-empty">Loading Bruski's photos...</p>
            ) : communityPhotos.length === 0 ? (
              <p className="community-photos-empty">No photo posts yet. When someone finishes a workout and shares, it will show up here.</p>
            ) : (
              <div className="community-photo-feed">
                {communityPhotos.map((p) => (
                  <article key={p._id} className="community-photo-card">
                    <div className="community-photo-card__header">
                      <div className="community-photo-card__identity">
                        {p.userId?.profilePhoto ? <img src={p.userId.profilePhoto} alt="" /> : <span>{(p.userId?.name || '?').charAt(0)}</span>}
                        <div>
                          <p>{p.userId?.name || 'Anonymous'}</p>
                          <small>{formatRelativeTime(p.createdAt)}</small>
                        </div>
                      </div>
                      <p className="community-photo-card__title">{p.workoutName || 'Workout post'}</p>
                    </div>

                    <div
                      className={
                        (p.recordsCount || 0) > 0
                          ? 'community-photo-card__stats community-photo-card__stats--with-prs'
                          : 'community-photo-card__stats'
                      }
                    >
                      <div className="community-photo-card__stat">
                        <span className="community-photo-card__stat-label">Time</span>
                        <span className="community-photo-card__stat-value">
                          <FiClock aria-hidden /> {formatDuration(p.durationSec)}
                        </span>
                      </div>
                      <div className="community-photo-card__stat">
                        <span className="community-photo-card__stat-label">Volume</span>
                        <span className="community-photo-card__stat-value">
                          <FiBarChart2 aria-hidden /> {totalVolumeKgToLb(p.totalVolume).toLocaleString()} lb
                        </span>
                      </div>
                      {(p.recordsCount || 0) > 0 ? (
                        <div className="community-photo-card__stat">
                          <span className="community-photo-card__stat-label">PRs</span>
                          <span className="community-photo-card__stat-value">
                            <FiAward aria-hidden /> {Number(p.recordsCount).toLocaleString()}
                          </span>
                        </div>
                      ) : null}
                      <div className="community-photo-card__stat">
                        <span className="community-photo-card__stat-label">Rank</span>
                        <span className="community-photo-card__stat-value">
                          <span aria-hidden>🏆</span> #{p.rankSnapshot || '-'}{p.rankTotalUsers ? `/${p.rankTotalUsers}` : ''}
                        </span>
                      </div>
                    </div>

                    <img className="community-photo-card__image" src={p.image} alt={p.caption || "Bruski's photos post"} />
                    {p.caption ? <p className="community-photo-card__caption">{p.caption}</p> : null}

                    <div className="community-photo-card__actions">
                      <button type="button" onClick={() => toggleLike(p._id)} className={p.likedByMe ? 'liked' : ''} aria-label="Like post">
                        <FiHeart /> {p.likesCount || 0}
                      </button>
                      <span className="community-photo-card__metric"><FiMessageCircle aria-hidden /> {(p.comments || []).length}</span>
                      {(p.canDelete || String(p.userId?._id || p.userId || '') === currentUserId) && (
                        <button
                          type="button"
                          className="community-photo-card__delete-btn"
                          onClick={() => handleDeleteCommunityPost(p._id)}
                          disabled={deletingPostId === p._id}
                        >
                          {deletingPostId === p._id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </div>
                    <p className="community-photo-card__likes-line">{Number(p.likesCount || 0).toLocaleString()} likes</p>

                    <div className="community-photo-card__comments">
                      {(p.comments || []).slice(-3).map((c) => (
                        <p key={c._id}><strong>{c.userId?.name || 'User'}:</strong> {c.text}</p>
                      ))}
                    </div>

                    <div className="community-photo-card__comment-box">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={commentDrafts[p._id] || ''}
                        onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [p._id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addComment(p._id);
                        }}
                      />
                      <button type="button" onClick={() => addComment(p._id)}><FiSend /></button>
                    </div>
                  </article>
                ))}
                {photosHasMore && (
                  <div ref={photosSentinelRef} className="community-photo-feed__loader">
                    {photosLoadingMore ? 'Loading more photos...' : 'Scroll for more'}
                  </div>
                )}
              </div>
            )}
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
                <div className="view-modal-creator-card">
                  <div className="view-modal-creator-card__identity">
                    {selectedWorkout.userId?.profilePhoto ? (
                      <img
                        src={selectedWorkout.userId.profilePhoto}
                        alt=""
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className="view-modal-creator-card__avatar-fallback"
                      style={{ display: selectedWorkout.userId?.profilePhoto ? 'none' : 'flex' }}
                    >
                      {(selectedWorkout.userId?.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="view-modal-creator-card__text">
                      <p className="view-modal-creator-card__name">
                        {selectedWorkout.userId?.name || 'Anonymous'}
                      </p>
                      <p className="view-modal-creator-card__email">
                        {selectedWorkout.userId?.email || 'No email'}
                      </p>
                    </div>
                  </div>
                  {selectedWorkout.userId?._id && (
                    <div className="view-modal-creator-card__actions">
                      <button
                        type="button"
                        className="view-modal-creator-btn view-modal-creator-btn--message"
                        onClick={() => {
                          setShowViewModal(false);
                          setChatWithUser(selectedWorkout.userId);
                          setCommunityTab('chat');
                        }}
                      >
                        <FiMessageCircle size={14} aria-hidden /> Message
                      </button>
                      <button
                        type="button"
                        className="view-modal-creator-btn view-modal-creator-btn--profile"
                        onClick={() => {
                          setShowViewModal(false);
                          navigate(`/profile/${selectedWorkout.userId._id}`);
                        }}
                      >
                        <FiUser size={14} aria-hidden /> View profile
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
