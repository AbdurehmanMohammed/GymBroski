import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { 
  FiCalendar, 
  FiTrendingUp, 
  FiUser, 
  FiLogOut,
  FiGlobe,
  FiActivity,
  FiAward,
  FiTarget,
  FiMenu,
  FiX,
  FiShield
} from 'react-icons/fi';
import { workoutsAPI, workoutSessionsAPI } from '../services/api';
import { isAdminUser } from '../utils/authRole';
import { signOutEverywhere, getParsedAuthUser } from '../utils/authStorage';
import ThemeToggle from './ThemeToggle';

const Progress = ({ theme = 'light', onToggleTheme }) => {
  const [workouts, setWorkouts] = useState([]);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalExercises: 0,
    publicWorkouts: 0,
    privateWorkouts: 0
  });
  const [completedSessions, setCompletedSessions] = useState(0);
  const [daysThisWeek, setDaysThisWeek] = useState(0);
  const [daysLastWeek, setDaysLastWeek] = useState(0);
  const [daysThisMonth, setDaysThisMonth] = useState(0);
  const [daysThisYear, setDaysThisYear] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);
  const navTo = (path) => {
    navigate(path);
    closeMenu();
  };

  const fetchProgressStats = async () => {
    try {
      const stats = await workoutSessionsAPI.getStats();
      setCompletedSessions(stats.totalCompleted ?? 0);
      setDaysThisWeek(stats.daysThisWeek ?? 0);
      setDaysLastWeek(stats.daysLastWeek ?? 0);
      setDaysThisMonth(stats.daysThisMonth ?? 0);
      setDaysThisYear(stats.daysThisYear ?? 0);
    } catch (err) {
      console.error('Failed to fetch progress stats:', err);
      setCompletedSessions(0);
      setDaysThisWeek(0);
      setDaysLastWeek(0);
      setDaysThisMonth(0);
      setDaysThisYear(0);
      if (err.status === 401) {
        void signOutEverywhere().then(() => navigate('/login'));
      }
    }
  };

  useEffect(() => {
    fetchProgressStats();
  }, []);

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const response = await workoutsAPI.getAll();
      const workoutsData = response;
      setWorkouts(workoutsData);

      // Calculate stats
      const totalExercises = workoutsData.reduce((sum, workout) => 
        sum + (workout.exercises?.length || 0), 0
      );
      const publicCount = workoutsData.filter(w => w.isPublic).length;
      const privateCount = workoutsData.filter(w => !w.isPublic).length;

      setStats({
        totalWorkouts: workoutsData.length,
        totalExercises: totalExercises,
        publicWorkouts: publicCount,
        privateWorkouts: privateCount
      });
    } catch (error) {
      console.error('Error fetching workouts:', error);
      if (error.response?.status === 401) {
        void signOutEverywhere().then(() => navigate('/login'));
      }
    }
  };

  const handleLogout = async () => {
    await signOutEverywhere();
    navigate('/login', { replace: true });
    window.location.reload();
  };

  const user = getParsedAuthUser() || {};

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
          <button type="button" className="nav-btn active" onClick={closeMenu}>
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

      <div className="main-content">
        <header>
          <button type="button" className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <FiMenu size={24} />
          </button>
          <div className="toggle-mobile">
            <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} variant="header" />
          </div>
          <div className="progress-page-header" style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0 }}>Your Progress</h1>
            <p className="progress-page-subtitle">
              Track your fitness journey
            </p>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="progress-stats-grid">
          {/* Workouts Completed (sessions) */}
          <div
            className="progress-stat-card"
            style={{ background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)' }}
          >
            <div className="progress-stat-card__head">
              <FiActivity size={36} aria-hidden />
              <h3 className="progress-stat-card__title">Workouts completed</h3>
            </div>
            <p className="progress-stat-card__value">{completedSessions}</p>
            <p className="progress-stat-card__hint">
              Sessions finished with duration &amp; progress
            </p>
          </div>

          {/* Days this week */}
          <div
            className="progress-stat-card"
            style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)' }}
          >
            <div className="progress-stat-card__head">
              <FiCalendar size={36} aria-hidden />
              <h3 className="progress-stat-card__title">This week</h3>
            </div>
            <p className="progress-stat-card__value">{daysThisWeek}</p>
            <p className="progress-stat-card__hint">Days you worked out</p>
          </div>

          {/* Days last week */}
          <div
            className="progress-stat-card"
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)' }}
          >
            <div className="progress-stat-card__head">
              <FiCalendar size={36} aria-hidden />
              <h3 className="progress-stat-card__title">Last week</h3>
            </div>
            <p className="progress-stat-card__value">{daysLastWeek}</p>
            <p className="progress-stat-card__hint">Days you worked out</p>
          </div>

          {/* This month */}
          <div
            className="progress-stat-card"
            style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)' }}
          >
            <div className="progress-stat-card__head">
              <FiCalendar size={36} aria-hidden />
              <h3 className="progress-stat-card__title">This month</h3>
            </div>
            <p className="progress-stat-card__value">{daysThisMonth}</p>
            <p className="progress-stat-card__hint">Workouts this month</p>
          </div>

          {/* This year */}
          <div
            className="progress-stat-card"
            style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' }}
          >
            <div className="progress-stat-card__head">
              <FiCalendar size={36} aria-hidden />
              <h3 className="progress-stat-card__title">This year</h3>
            </div>
            <p className="progress-stat-card__value">{daysThisYear}</p>
            <p className="progress-stat-card__hint">Workouts this year</p>
          </div>

          {/* Workout Splits (templates) */}
          <div
            className="progress-stat-card"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            <div className="progress-stat-card__head">
              <FiCalendar size={36} aria-hidden />
              <h3 className="progress-stat-card__title">Workout splits</h3>
            </div>
            <p className="progress-stat-card__value">{stats.totalWorkouts}</p>
            <p className="progress-stat-card__hint">Splits created</p>
          </div>

          {/* Total Exercises */}
          <div
            className="progress-stat-card"
            style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
          >
            <div className="progress-stat-card__head">
              <FiTarget size={36} aria-hidden />
              <h3 className="progress-stat-card__title">Total exercises</h3>
            </div>
            <p className="progress-stat-card__value">{stats.totalExercises}</p>
            <p className="progress-stat-card__hint">Exercises in your workouts</p>
          </div>

          {/* Public Workouts */}
          <div
            className="progress-stat-card"
            style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}
          >
            <div className="progress-stat-card__head">
              <FiGlobe size={36} aria-hidden />
              <h3 className="progress-stat-card__title">Public workouts</h3>
            </div>
            <p className="progress-stat-card__value">{stats.publicWorkouts}</p>
            <p className="progress-stat-card__hint">Shared with community</p>
          </div>

          {/* Private Workouts */}
          <div
            className="progress-stat-card"
            style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}
          >
            <div className="progress-stat-card__head">
              <FiAward size={36} aria-hidden />
              <h3 className="progress-stat-card__title">Private workouts</h3>
            </div>
            <p className="progress-stat-card__value">{stats.privateWorkouts}</p>
            <p className="progress-stat-card__hint">Keep it personal</p>
          </div>
        </div>

        {/* Recent Workouts */}
        <div className="progress-recent-workouts">
          <h2 className="progress-recent-title">Recent Workouts</h2>
          
          {workouts.length === 0 ? (
            <p className="progress-recent-empty">No workouts yet. Start creating!</p>
          ) : (
            <div className="progress-recent-list">
              {workouts.slice(0, 5).map((workout) => (
                <div key={workout._id} className="progress-recent-item">
                  <div>
                    <h4 className="progress-recent-item-name">{workout.name}</h4>
                    <p className="progress-recent-item-meta">
                      {workout.exercises?.length || 0} exercises • {workout.isPublic ? 'Public' : 'Private'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="progress-recent-view-btn"
                    onClick={() => navigate('/dashboard')}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Progress;
