import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { 
  FiCalendar, 
  FiTrendingUp, 
  FiUser, 
  FiLogOut,
  FiGlobe,
  FiMail,
  FiEdit,
  FiSave,
  FiCamera,
  FiActivity,
  FiMenu,
  FiX,
  FiImage,
  FiPlus,
  FiTrash2,
  FiAward,
  FiBell,
  FiMaximize2,
  FiUploadCloud,
  FiShield
} from 'react-icons/fi';
import { profileAPI, progressPhotosAPI, workoutAPI } from '../services/api';
import { invalidateFromAuthFailure } from '../utils/sessionInvalidation';
import { isAdminUser } from '../utils/authRole';
import { getParsedAuthUser, setAuthUserJson, signOutEverywhere } from '../utils/authStorage';
import ThemeToggle from './ThemeToggle';
import LeaderboardRankBadge from './LeaderboardRankBadge';
/** Browser/OS timezone (e.g. America/Toronto, Asia/Riyadh) — no manual pick */
function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const Profile = ({ theme = 'light', onToggleTheme }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getParsedAuthUser());
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name || '',
    profilePhoto: user.profilePhoto || ''
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileTab, setProfileTab] = useState('account');
  const [photos, setPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    image: '',
    label: 'progress',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const [emailWorkoutReminders, setEmailWorkoutReminders] = useState(true);
  const [emailChatNotifications, setEmailChatNotifications] = useState(true);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [myWorkouts, setMyWorkouts] = useState([]);
  const closeMenu = () => setMenuOpen(false);
  const navTo = (path) => {
    navigate(path);
    closeMenu();
  };

  const isDark = theme === 'dark';
  const profileStyles = {
    cardBg: isDark ? 'rgba(30, 41, 59, 0.95)' : 'white',
    textPrimary: isDark ? '#e5e7eb' : '#333',
    textMuted: isDark ? '#9ca3af' : 'var(--text-label)',
    textSubtle: isDark ? '#94a3b8' : 'var(--text-subtle)',
    fieldBg: isDark ? 'rgba(51, 65, 85, 0.5)' : '#f8f9fa',
    borderColor: isDark ? 'rgba(148, 163, 184, 0.25)' : '#e2e8f0',
    boxShadow: isDark ? '0 4px 6px rgba(0,0,0,0.3)' : '0 4px 6px rgba(0,0,0,0.1)',
  };

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await workoutAPI.getAll();
        if (!cancelled) setMyWorkouts(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Failed to load workouts for schedule', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch progress photos when tab is photos
  useEffect(() => {
    if (profileTab === 'photos') fetchPhotos();
  }, [profileTab]);

  useEffect(() => {
    if (!lightboxPhoto) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxPhoto(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxPhoto]);

  const photoBadgeClass = (label) => {
    const l = String(label || '').toLowerCase();
    if (l === 'before') return 'progress-photo-badge progress-photo-badge--before';
    if (l === 'after') return 'progress-photo-badge progress-photo-badge--after';
    return 'progress-photo-badge progress-photo-badge--progress';
  };

  const formatPhotoLabel = (label) => {
    const l = String(label || 'progress');
    return l.charAt(0).toUpperCase() + l.slice(1);
  };

  const loadImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const r = new FileReader();
    r.onloadend = () => setAddForm((prev) => ({ ...prev, image: r.result }));
    r.readAsDataURL(file);
  };

  const onUploadDrop = (e) => {
    e.preventDefault();
    setUploadDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    loadImageFile(f);
  };

  const onUploadDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  /** Plays when user opens an "After" photo full-screen (requires user tap — browser allows audio). */
  const AFTER_PHOTO_SOUND = '/sounds/nice-sound.mp3';

  const openProgressLightbox = (p) => {
    setLightboxPhoto(p);
    if (String(p?.label || '').toLowerCase() !== 'after') return;
    try {
      const audio = new Audio(AFTER_PHOTO_SOUND);
      audio.volume = 0.55;
      audio.play().catch(() => {
        /* Autoplay policy or missing file — ignore */
      });
    } catch (_) {
      /* ignore */
    }
  };

  const fetchPhotos = async () => {
    setPhotosLoading(true);
    try {
      const data = await progressPhotosAPI.getAll();
      setPhotos(data || []);
    } catch (e) {
      console.error('Error fetching progress photos:', e);
      setPhotos([]);
    } finally {
      setPhotosLoading(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!addForm.image) {
      alert('Please select an image');
      return;
    }
    setAddSubmitting(true);
    try {
      await progressPhotosAPI.add(addForm);
      setAddModalOpen(false);
      setAddForm({ image: '', label: 'progress', date: new Date().toISOString().slice(0, 10), notes: '' });
      fetchPhotos();
    } catch (e) {
      console.error('Error adding photo:', e);
      alert('Failed to add photo');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleDeletePhoto = async (id) => {
    if (!window.confirm('Delete this progress photo?')) return;
    try {
      await progressPhotosAPI.delete(id);
      fetchPhotos();
    } catch (e) {
      console.error('Error deleting photo:', e);
      alert('Failed to delete photo');
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await profileAPI.getProfile();
      const currentUser = getParsedAuthUser();
      const userData = { ...currentUser, ...response };
      setUser(userData);
      setFormData({
        name: userData.name || '',
        profilePhoto: userData.profilePhoto || ''
      });
      setEmailWorkoutReminders(userData.emailWorkoutReminders !== false);
      setEmailChatNotifications(userData.emailChatNotifications !== false);
      setAuthUserJson(userData);

      const tz = getDeviceTimeZone();
      if ((userData.timezone || '').trim() !== tz) {
        try {
          const tzUp = await profileAPI.updateProfile({ timezone: tz });
          const merged = { ...userData, ...tzUp };
          setUser(merged);
          setAuthUserJson(merged);
        } catch (_) {
          /* keep userData if sync fails */
        }
      }
    } catch (error) {
      if (invalidateFromAuthFailure(error.status, error.message)) return;
      console.error('Error fetching profile:', error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result;
          const response = await profileAPI.updateProfile({ profilePhoto: base64String });
          
          // Update state and localStorage
          setUser(response);
          setFormData({ ...formData, profilePhoto: response.profilePhoto });
          setAuthUserJson(response);
          
          alert('Profile photo updated!');
        } catch (error) {
          console.error('Error uploading photo:', error);
          alert('Failed to upload photo');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read file');
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await profileAPI.updateProfile({ name: formData.name });
      
      // Update user in localStorage and state
      const updatedUser = { ...user, ...response };
      setUser(updatedUser);
      setAuthUserJson(updatedUser);
      
      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReminders = async () => {
    setReminderSaving(true);
    try {
      const response = await profileAPI.updateProfile({
        emailWorkoutReminders,
        emailChatNotifications,
        workoutReminderHour: 6,
        workoutReminderMinute: 0,
        timezone: getDeviceTimeZone(),
      });
      const currentUser = getParsedAuthUser();
      const userData = { ...currentUser, ...response };
      setUser(userData);
      setAuthUserJson(userData);
      alert('Notification settings saved!');
    } catch (error) {
      console.error('Error saving reminders:', error);
      alert(error.message || 'Failed to save reminder settings');
    } finally {
      setReminderSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOutEverywhere();
    navigate('/login', { replace: true });
    window.location.reload();
  };

  const getInitials = () => {
    return user.name?.charAt(0).toUpperCase() || 'U';
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
          {isAdminUser() && (
            <button type="button" className="nav-btn" onClick={() => navTo('/admin')}>
              <FiShield /> Admin
            </button>
          )}
          <button type="button" className="nav-btn active" onClick={closeMenu}>
            <FiUser /> Profile
          </button>
        </nav>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          <FiLogOut /> Logout
        </button>
      </div>

      <div className="main-content">
        <header className="profile-page-header">
          <div className="profile-page-header__tools">
            <button type="button" className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <FiMenu size={24} />
            </button>
            <div className="toggle-mobile">
              <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} variant="header" />
            </div>
          </div>
          <div className="profile-page-header__titles">
            <h1>My Profile</h1>
            <p className="profile-page-header__subtitle">Manage your account settings</p>
          </div>
        </header>

        {/* Tab bar */}
        <div className="profile-page-tabs">
          <button
            type="button"
            className={`profile-page-tab ${profileTab === 'account' ? 'profile-page-tab--active' : ''}`}
            onClick={() => setProfileTab('account')}
          >
            Account
          </button>
          <button
            type="button"
            className={`profile-page-tab profile-page-tab--with-icon ${profileTab === 'photos' ? 'profile-page-tab--active' : ''}`}
            onClick={() => setProfileTab('photos')}
          >
            <FiImage aria-hidden /> Progress Photos
          </button>
        </div>

        {profileTab === 'account' && (
        /* Profile Card */
        <div style={{
          background: profileStyles.cardBg,
          borderRadius: '15px',
          padding: '40px',
          marginTop: '30px',
          boxShadow: profileStyles.boxShadow,
          maxWidth: '720px',
          border: isDark ? '1px solid rgba(148, 163, 184, 0.2)' : 'none'
        }}>
          {/* Avatar with Upload */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '30px'
          }}>
            <div style={{
              position: 'relative',
              marginBottom: '15px'
            }}>
              {/* Profile Photo */}
              {formData.profilePhoto ? (
                <img 
                  src={formData.profilePhoto}
                  alt="Profile"
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '4px solid #667eea'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              
              {/* Initials Fallback */}
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: formData.profilePhoto ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                color: 'white',
                fontWeight: 'bold'
              }}>
                {getInitials()}
              </div>

              {/* Camera Button for Upload */}
              <label
                htmlFor="photo-upload"
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  background: '#667eea',
                  color: 'white',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  border: isDark ? '3px solid rgba(30, 41, 59, 0.95)' : '3px solid white',
                  transition: 'all 0.3s ease',
                  opacity: uploading ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!uploading) e.currentTarget.style.background = '#5568d3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#667eea';
                }}
              >
                <FiCamera size={20} />
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Upload Status */}
            {uploading && (
              <p style={{
                fontSize: '14px',
                color: '#667eea',
                fontWeight: '600',
                marginTop: '10px'
              }}>
                Uploading photo...
              </p>
            )}
            
            <p style={{
              fontSize: '13px',
              color: profileStyles.textSubtle,
              textAlign: 'center',
              marginTop: '10px'
            }}>
              📸 Click camera icon to upload from your device
            </p>
          </div>

          {/* Profile Info */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ margin: 0, color: profileStyles.textPrimary }}>Profile Information</h2>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  <FiEdit /> Edit
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: '#2e7d32',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  <FiSave /> {loading ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>

            {/* Name Field */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: profileStyles.textMuted,
                marginBottom: '8px'
              }}>
                Full Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `2px solid ${profileStyles.borderColor}`,
                    borderRadius: '10px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    background: isDark ? 'rgba(15, 23, 42, 0.9)' : 'white',
                    color: profileStyles.textPrimary
                  }}
                />
              ) : (
                <div style={{
                  padding: '12px',
                  background: profileStyles.fieldBg,
                  borderRadius: '10px',
                  fontSize: '16px',
                  color: profileStyles.textPrimary
                }}>
                  {user.name}
                </div>
              )}
            </div>

            {/* Email Field */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: profileStyles.textMuted,
                marginBottom: '8px'
              }}>
                Email Address
              </label>
              <div style={{
                padding: '12px',
                background: profileStyles.fieldBg,
                borderRadius: '10px',
                fontSize: '16px',
                color: profileStyles.textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <FiMail color="#667eea" />
                {user.email}
              </div>
              <p style={{ 
                margin: '8px 0 0 0', 
                fontSize: '13px', 
                color: profileStyles.textSubtle 
              }}>
                Email cannot be changed
              </p>
            </div>

            {/* Workout email reminders (day-specific) */}
            <div style={{
              marginBottom: '28px',
              padding: '20px',
              borderRadius: '12px',
              border: `1px solid ${profileStyles.borderColor}`,
              background: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(102, 126, 234, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <FiMail color="#667eea" />
                <h3 style={{ margin: 0, fontSize: '17px', color: profileStyles.textPrimary }}>
                  Workout email reminders
                </h3>
              </div>
              <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: profileStyles.textMuted, lineHeight: 1.45 }}>
                Your week is built when you <strong>create or edit a workout</strong> — you pick which days that split
                runs. Any day without a workout is a rest day. We email once in the morning (~6:00 local) on training
                days only — timezone below.
              </p>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: profileStyles.textPrimary }}>
                  Your week at a glance
                </p>
                {myWorkouts.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '13px', color: profileStyles.textSubtle, lineHeight: 1.45 }}>
                    Create workouts under <strong>My Workouts</strong> and choose training days in the create / edit
                    flow.
                  </p>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {WEEKDAY_LABELS.map((label, d) => {
                      const row = (user.workoutSchedule || []).find((s) => Number(s.day) === d);
                      const wid = row?.workoutId?._id ?? row?.workoutId;
                      const wname = wid
                        ? myWorkouts.find((w) => String(w._id) === String(wid))?.name
                        : null;
                      return (
                        <li
                          key={d}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '8px 0',
                            borderBottom: `1px solid ${profileStyles.borderColor}`,
                            fontSize: '13px',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: profileStyles.textPrimary }}>{label}</span>
                          <span style={{ color: wname ? profileStyles.textPrimary : profileStyles.textSubtle }}>
                            {wname || 'Rest'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '14px' }}>
                <input
                  type="checkbox"
                  checked={emailWorkoutReminders}
                  onChange={(e) => setEmailWorkoutReminders(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#667eea' }}
                />
                <span style={{ fontSize: '14px', fontWeight: 600, color: profileStyles.textPrimary }}>
                  Send me workout reminder emails
                </span>
              </label>
              <div
                style={{
                  marginBottom: '4px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(51, 65, 85, 0.35)' : 'rgba(102, 126, 234, 0.08)',
                  border: `1px solid ${profileStyles.borderColor}`
                }}
              >
                <p style={{ margin: 0, fontSize: '13px', color: profileStyles.textPrimary, fontWeight: 600 }}>
                  Time zone: <code style={{ fontSize: '13px', fontWeight: 600 }}>{getDeviceTimeZone()}</code>
                </p>
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: profileStyles.textSubtle, lineHeight: 1.4 }}>
                  From your device. Save after you travel so reminders stay correct.
                </p>
              </div>

              <div style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: `1px solid ${profileStyles.borderColor}`
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', color: profileStyles.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiBell color="#667eea" size={18} />
                  Chat emails
                </h4>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: profileStyles.textMuted, lineHeight: 1.5 }}>
                  The <strong>other person</strong> gets the email (not you). They must turn this on below and save.
                </p>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '12px' }}>
                  <input
                    type="checkbox"
                    checked={emailChatNotifications}
                    onChange={(e) => setEmailChatNotifications(e.target.checked)}
                    style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: '#667eea', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: profileStyles.textPrimary }}>
                    Email me when someone sends a private or group message
                  </span>
                </label>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: profileStyles.textSubtle, lineHeight: 1.45 }}>
                  Desktop pop-ups for new chat messages when you’re in another tab are <strong>enabled</strong>. To turn them off, use your browser’s site settings for this page (not Profile).
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveReminders}
                disabled={reminderSaving}
                style={{
                  marginTop: '18px',
                  width: '100%',
                  padding: '12px 16px',
                  background: reminderSaving ? '#94a3b8' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: reminderSaving ? 'not-allowed' : 'pointer'
                }}
              >
                {reminderSaving ? 'Saving…' : 'Save email settings'}
              </button>
            </div>

            {/* Challenge Points */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: profileStyles.textMuted,
                marginBottom: '8px'
              }}>
                Challenge Points
              </label>
              <div style={{
                padding: '12px',
                background: isDark ? 'rgba(99, 102, 241, 0.15)' : 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                borderRadius: '10px',
                fontSize: '16px',
                color: profileStyles.textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <FiAward color="#667eea" size={20} />
                <strong>{user.points ?? 0}</strong> pts
                <button
                  type="button"
                  onClick={() => navTo('/challenges')}
                  style={{
                    marginLeft: 'auto',
                    padding: '6px 12px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  View Leaderboard
                </button>
              </div>
              {user.leaderboardRank != null && user.leaderboardTotalUsers != null && (
                <div style={{ marginTop: '14px' }}>
                  <LeaderboardRankBadge rank={user.leaderboardRank} totalUsers={user.leaderboardTotalUsers} />
                </div>
              )}
            </div>

            {/* Member Since */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: profileStyles.textMuted,
                marginBottom: '8px'
              }}>
                Member Since
              </label>
              <div style={{
                padding: '12px',
                background: profileStyles.fieldBg,
                borderRadius: '10px',
                fontSize: '16px',
                color: profileStyles.textPrimary
              }}>
                {new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>

          {/* Cancel button when editing */}
          {isEditing && (
            <button
              onClick={() => {
                setIsEditing(false);
                setFormData({
                  name: user.name || '',
                  profilePhoto: user.profilePhoto || ''
                });
              }}
              style={{
                width: '100%',
                padding: '14px',
                background: isDark ? 'rgba(71, 85, 105, 0.6)' : '#e2e8f0',
                color: profileStyles.textPrimary,
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '15px'
              }}
            >
              Cancel
            </button>
          )}

          {/* Account Actions */}
          <div style={{
            paddingTop: '30px',
            borderTop: `1px solid ${profileStyles.borderColor}`
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: profileStyles.textPrimary }}>
              Account Actions
            </h3>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '14px',
                background: '#fed7d7',
                color: '#c53030',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <FiLogOut /> Logout
            </button>
          </div>
        </div>
        )}

        {profileTab === 'photos' && (
        <div className="progress-photos-section track-panel">
          <div className="progress-photos-header">
            <div className="progress-photos-header-text">
              <h2 className="progress-photos-title">Progress photos</h2>
              <p className="progress-photos-sub">
                Capture before / after shots and milestones. Tap a photo to view it full size.
              </p>
            </div>
            <button
              type="button"
              className="progress-photos-add-btn"
              onClick={() => setAddModalOpen(true)}
            >
              <FiPlus size={18} /> Add photo
            </button>
          </div>
          {photosLoading ? (
            <p className="progress-photos-skeleton">Loading your photos…</p>
          ) : photos.length === 0 ? (
            <div className="progress-photos-empty">
              <div className="progress-photos-empty-icon" aria-hidden>
                <FiImage />
              </div>
              <p className="progress-photos-empty-title">No photos yet</p>
              <p className="progress-photos-empty-desc">
                Add your first progress shot to see your transformation over time.
              </p>
              <button
                type="button"
                className="progress-photos-add-btn"
                onClick={() => setAddModalOpen(true)}
              >
                <FiPlus size={18} /> Add your first photo
              </button>
            </div>
          ) : (
            <div className="progress-photos-grid">
              {photos.map((p) => (
                <article key={p._id} className="progress-photo-card">
                  <span className={photoBadgeClass(p.label)}>{formatPhotoLabel(p.label)}</span>
                  <button
                    type="button"
                    className="progress-photo-card__delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePhoto(p._id);
                    }}
                    aria-label="Delete photo"
                  >
                    <FiTrash2 size={17} />
                  </button>
                  <button
                    type="button"
                    className="progress-photo-card__media"
                    onClick={() => openProgressLightbox(p)}
                  >
                    <span className="progress-photo-card__shine" aria-hidden />
                    <img src={p.image} alt="" />
                    <div className="progress-photo-card__overlay">
                      <span>
                        <FiMaximize2 size={14} /> Tap to expand
                      </span>
                    </div>
                  </button>
                  <div className="progress-photo-card__body">
                    <div className="progress-photo-card__date-row">
                      <FiCalendar size={13} aria-hidden />
                      {p.date
                        ? new Date(p.date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : '—'}
                    </div>
                    {p.notes ? (
                      <p className="progress-photo-card__notes">{p.notes}</p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        )}

        {lightboxPhoto &&
          createPortal(
            <div
              className="progress-photo-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="Photo preview"
              onClick={() => setLightboxPhoto(null)}
            >
              <button
                type="button"
                className="progress-photo-lightbox__close"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxPhoto(null);
                }}
                aria-label="Close"
              >
                <FiX size={22} />
              </button>
              <img
                className="progress-photo-lightbox__img"
                src={lightboxPhoto.image}
                alt=""
                onClick={(e) => e.stopPropagation()}
              />
              <div className="progress-photo-lightbox__meta" onClick={(e) => e.stopPropagation()}>
                <h4>
                  {formatPhotoLabel(lightboxPhoto.label)}
                  {lightboxPhoto.date &&
                    ` · ${new Date(lightboxPhoto.date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}`}
                </h4>
                {lightboxPhoto.notes ? <p>{lightboxPhoto.notes}</p> : null}
              </div>
            </div>,
            document.body
          )}

        {/* Add Photo Modal */}
        {addModalOpen && (
          <div
            className="modal-overlay progress-photo-modal-overlay"
            onClick={() => !addSubmitting && setAddModalOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setAddModalOpen(false)}
            role="presentation"
          >
            <div
              className="modal-content progress-photo-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="progress-photo-modal-title"
            >
              <div className="modal-header progress-photo-modal__header">
                <div className="progress-photo-modal__headline">
                  <h3 id="progress-photo-modal-title" className="progress-photo-modal__title">
                    Add progress photo
                  </h3>
                  <p className="progress-photo-modal__subtitle">
                    Upload a picture for your timeline — drag & drop or browse.
                  </p>
                </div>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => !addSubmitting && setAddModalOpen(false)}
                  aria-label="Close"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="progress-photo-form">
                <div className="progress-photo-form__field">
                  <span className="form-label" id="photo-upload-label">
                    Photo
                  </span>
                  <input
                    ref={fileInputRef}
                    id="progress-photo-file"
                    className="progress-photo-file-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      loadImageFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                    aria-labelledby="photo-upload-label"
                  />
                  {!addForm.image ? (
                    <label
                      htmlFor="progress-photo-file"
                      className={`progress-photo-dropzone ${uploadDragActive ? 'progress-photo-dropzone--active' : ''}`}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setUploadDragActive(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        if (e.currentTarget === e.target) setUploadDragActive(false);
                      }}
                      onDragOver={onUploadDragOver}
                      onDrop={onUploadDrop}
                    >
                      <span className="progress-photo-dropzone__icon" aria-hidden>
                        <FiUploadCloud size={36} />
                      </span>
                      <span className="progress-photo-dropzone__title">Drop image here or click to browse</span>
                      <span className="progress-photo-dropzone__hint">JPG, PNG, WebP — best under 5MB</span>
                    </label>
                  ) : (
                    <div className="progress-photo-preview-wrap">
                      <img className="progress-photo-preview" src={addForm.image} alt="Selected preview" />
                      <div className="progress-photo-preview-actions">
                        <button
                          type="button"
                          className="progress-photo-change-btn"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Choose different image
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="progress-photo-form__field">
                  <span className="form-label" id="label-pills-label">
                    Type
                  </span>
                  <div
                    className="progress-photo-pills"
                    role="radiogroup"
                    aria-labelledby="label-pills-label"
                  >
                    {['before', 'after', 'progress'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        role="radio"
                        aria-checked={addForm.label === val}
                        className={`progress-photo-pill progress-photo-pill--${val} ${
                          addForm.label === val ? 'progress-photo-pill--selected' : ''
                        }`}
                        onClick={() => setAddForm((prev) => ({ ...prev, label: val }))}
                      >
                        {formatPhotoLabel(val)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="progress-photo-form__field">
                  <label className="form-label" htmlFor="progress-photo-date">
                    Date taken
                  </label>
                  <div className="progress-photo-date-wrap">
                    <FiCalendar className="progress-photo-date-icon" size={18} aria-hidden />
                    <input
                      id="progress-photo-date"
                      type="date"
                      value={addForm.date}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <p className="progress-photo-help">Defaults to today if you don’t change it.</p>
                </div>

                <div className="progress-photo-form__field">
                  <label className="form-label" htmlFor="progress-photo-notes">
                    Notes <span className="progress-photo-optional">(optional)</span>
                  </label>
                  <textarea
                    id="progress-photo-notes"
                    placeholder="e.g. Week 4 cut, morning fasted"
                    rows={3}
                    value={addForm.notes}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div className="progress-photo-form-actions">
                  <button
                    type="button"
                    className="progress-photo-form-btn progress-photo-form-btn--ghost"
                    onClick={() => !addSubmitting && setAddModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="progress-photo-form-btn progress-photo-form-btn--primary"
                    onClick={handleAddPhoto}
                    disabled={addSubmitting || !addForm.image}
                  >
                    {addSubmitting ? 'Saving…' : 'Save photo'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
