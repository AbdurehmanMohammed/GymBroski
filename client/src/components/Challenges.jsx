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
  FiMenu,
  FiX,
  FiAward,
  FiTarget
} from 'react-icons/fi';
import { challengesAPI, profileAPI } from '../services/api';
import ThemeToggle from './ThemeToggle';

/** How many leaderboard rows to show before "Show all" */
const LEADERBOARD_TOP_COUNT = 10;

const Challenges = ({ theme = 'light', onToggleTheme }) => {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myPoints, setMyPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaderboardShowAll, setLeaderboardShowAll] = useState(false);

  const closeMenu = () => setMenuOpen(false);
  const navTo = (path) => {
    navigate(path);
    closeMenu();
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [chList, leaderData, profileData] = await Promise.all([
        challengesAPI.getList(),
        challengesAPI.getLeaderboard(),
        profileAPI.getProfile()
      ]);
      setChallenges(chList);
      setLeaderboard(leaderData);
      setMyPoints(profileData?.points ?? 0);
    } catch (e) {
      console.error('Error loading challenges:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
    window.location.reload();
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const leaderboardHasMore = leaderboard.length > LEADERBOARD_TOP_COUNT;
  const leaderboardVisible =
    leaderboardShowAll || !leaderboardHasMore
      ? leaderboard
      : leaderboard.slice(0, LEADERBOARD_TOP_COUNT);

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
          <button type="button" className="nav-btn active" onClick={closeMenu}>
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
          <div className="challenges-header-text">
            <h1>Challenges</h1>
            <p className="challenges-subtitle">Premier League style – earn points for every action</p>
          </div>
        </header>

        {loading ? (
          <p style={{ color: theme === 'dark' ? '#9ca3af' : 'var(--text-label)', marginTop: '20px' }}>Loading...</p>
        ) : (
          <div className="challenges-page-content">
            <div className="challenges-points-banner">
              <span className="challenges-points-banner__emoji" aria-hidden>🏆</span>
              <div className="challenges-points-banner__body">
                <h3 className="challenges-points-banner__label">Your points</h3>
                <p className="challenges-points-banner__value">{myPoints}</p>
                <p className="challenges-points-banner__hint">Complete tasks below to earn more</p>
              </div>
            </div>

            <div className="challenges-main-grid">
              <section
                className={`challenges-panel challenges-panel--earn ${theme === 'dark' ? 'challenges-panel--dark track-panel' : ''}`}
              >
                <h2 className="challenges-panel__title">
                  <FiTarget className="challenges-panel__title-icon" size={22} aria-hidden />
                  Ways to earn
                </h2>
                <ul className="challenges-earn-list">
                  {challenges.map((c) => (
                    <li key={c.id} className="challenges-earn-row">
                      <span className="challenges-earn-row__icon" aria-hidden>{c.icon}</span>
                      <span className={`challenges-earn-row__name ${theme === 'dark' ? 'challenges-earn-row__name--dark' : ''}`}>
                        {c.name}
                      </span>
                      <span className="challenges-earn-row__pts">+{c.points} pts</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section
                className={`challenges-panel challenges-panel--board ${theme === 'dark' ? 'challenges-panel--dark track-panel' : ''}`}
              >
                <h2 className="challenges-panel__title">
                  <FiAward className="challenges-panel__title-icon" size={22} aria-hidden />
                  Leaderboard
                </h2>
                {leaderboard.length === 0 ? (
                  <p className="challenges-board-empty">No scores yet — be first on the board.</p>
                ) : (
                  <>
                  <ul className="challenges-lb-list">
                    {leaderboardVisible.map((entry, i) => (
                      <li
                        key={entry.userId}
                        className={`challenges-lb-row challenges-lb-row--${i < 3 ? ['gold', 'silver', 'bronze'][i] : 'rest'}${String(user.id || user._id) === String(entry.userId) ? ' challenges-lb-row--you' : ''}`}
                      >
                        <span className={`challenges-lb-rank challenges-lb-rank--${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default'}`}>
                          #{entry.rank}
                        </span>
                        {entry.profilePhoto ? (
                          <img className="challenges-lb-avatar" src={entry.profilePhoto} alt="" />
                        ) : (
                          <div className="challenges-lb-avatar challenges-lb-avatar--fallback">
                            {entry.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="challenges-lb-info">
                          <span className={`challenges-lb-name ${theme === 'dark' ? 'challenges-lb-name--dark' : ''}`}>
                            {entry.name}
                            {String(user.id || user._id) === String(entry.userId) && (
                              <span className="challenges-lb-you">(you)</span>
                            )}
                          </span>
                          {entry.topOn && entry.topOn.length > 0 && (
                            <span className={`challenges-lb-topon ${theme === 'dark' ? 'challenges-lb-topon--dark' : ''}`}>
                              {entry.topOn.map((t) => `${t.icon} ${t.label}`).join(' · ')}
                            </span>
                          )}
                        </div>
                        <span className="challenges-lb-score">{entry.points} pts</span>
                      </li>
                    ))}
                  </ul>
                  {leaderboardHasMore && (
                    <div className="challenges-lb-footer">
                      <button
                        type="button"
                        className={`challenges-lb-toggle ${theme === 'dark' ? 'challenges-lb-toggle--dark' : ''}`}
                        onClick={() => setLeaderboardShowAll((v) => !v)}
                        aria-expanded={leaderboardShowAll}
                      >
                        {leaderboardShowAll
                          ? 'Show less'
                          : `Show all (${leaderboard.length - LEADERBOARD_TOP_COUNT} more)`}
                      </button>
                    </div>
                  )}
                  </>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Challenges;
