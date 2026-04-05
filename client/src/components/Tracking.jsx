import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import {
  FiCalendar, FiTrendingUp, FiUser, FiLogOut, FiGlobe, FiZap,
  FiPlus, FiTrash2, FiDroplet, FiActivity, FiAward, FiMenu, FiX, FiChevronDown, FiShield
} from 'react-icons/fi';
import { trackingAPI, workoutsAPI } from '../services/api';
import { isAdminUser } from '../utils/authRole';
import ThemeToggle from './ThemeToggle';
import { CaloriesCalculatorPanel } from './CaloriesCalculator';

const VALID_TRACK_TABS = ['weight', 'water', 'pr', 'calories'];

const Tracking = ({ theme = 'light', onToggleTheme }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = VALID_TRACK_TABS.includes(tabParam) ? tabParam : 'weight';
  const setTab = (t) => {
    if (!VALID_TRACK_TABS.includes(t)) return;
    if (t === 'weight') setSearchParams({}, { replace: true });
    else setSearchParams({ tab: t }, { replace: true });
  };
  const [weightEntries, setWeightEntries] = useState([]);
  const [waterToday, setWaterToday] = useState({ total: 0, entries: [] });
  const [prs, setPRs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [weightForm, setWeightForm] = useState({ weight: '', notes: '' });
  const [waterForm, setWaterForm] = useState({ amount: 250 });
  const [prForm, setPRForm] = useState({ exerciseName: '', weight: '', reps: '1' });
  const [prCustomExercise, setPrCustomExercise] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exerciseDropdownOpen, setExerciseDropdownOpen] = useState(false);
  const exerciseDropdownRef = useRef(null);
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exerciseDropdownRef.current && !exerciseDropdownRef.current.contains(e.target)) {
        setExerciseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const fetchWeight = async () => {
    try {
      const data = await trackingAPI.getBodyWeight();
      setWeightEntries(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWater = async () => {
    try {
      const data = await trackingAPI.getWaterToday();
      setWaterToday(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPRs = async () => {
    try {
      const data = await trackingAPI.getPR();
      setPRs(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchWeight();
  }, []);

  useEffect(() => {
    if (tab === 'water') fetchWater();
    if (tab === 'pr') {
      fetchPRs();
      (async () => {
        try {
          const workouts = await workoutsAPI.getAll();
          const names = [...new Set(
            (workouts || []).flatMap((w) =>
              (w.exercises || []).map((e) => e.name?.trim()).filter(Boolean)
            )
          )].sort((a, b) => a.localeCompare(b));
          setWorkoutExercises(names);
        } catch (e) {
          console.error(e);
          setWorkoutExercises([]);
        }
      })();
    }
  }, [tab]);

  const handleAddWeight = async (e) => {
    e.preventDefault();
    const w = parseFloat(weightForm.weight);
    if (!weightForm.weight || Number.isNaN(w) || w < 0) return;
    setLoading(true);
    try {
      await trackingAPI.addBodyWeight({
        weight: w,
        notes: weightForm.notes
      });
      setWeightForm({ weight: '', notes: '' });
      fetchWeight();
    } catch (e) {
      alert('Failed to add');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWater = async () => {
    const amt = Math.max(0, waterForm.amount || 0);
    if (amt <= 0) return;
    setLoading(true);
    try {
      await trackingAPI.addWater({ amount: amt });
      fetchWater();
    } catch (e) {
      alert('Failed to add');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWater = async (id) => {
    if (!window.confirm('Remove this water entry?')) return;
    setLoading(true);
    try {
      await trackingAPI.deleteWater(id);
      fetchWater();
    } catch (e) {
      alert('Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBodyWeight = async (id) => {
    if (!window.confirm('Remove this body weight entry?')) return;
    setLoading(true);
    try {
      await trackingAPI.deleteBodyWeight(id);
      fetchWeight();
    } catch (e) {
      alert('Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePR = async (id) => {
    if (!window.confirm('Remove this PR?')) return;
    setLoading(true);
    try {
      await trackingAPI.deletePR(id);
      fetchPRs();
    } catch (e) {
      alert('Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPR = async (e) => {
    e.preventDefault();
    const w = parseFloat(prForm.weight);
    const r = parseInt(prForm.reps, 10) || 1;
    const exerciseName = prForm.exerciseName === '__other__' ? prCustomExercise?.trim() : prForm.exerciseName?.trim();
    if (!exerciseName || !prForm.weight || Number.isNaN(w) || w < 0 || r < 1) return;
    setLoading(true);
    try {
      await trackingAPI.addPR({
        exerciseName,
        weight: w,
        reps: r
      });
      setPRForm({ exerciseName: '', weight: '', reps: '1' });
      setPrCustomExercise('');
      fetchPRs();
    } catch (e) {
      alert('Failed to add');
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

  const navBtn = (path, label, icon) => (
    <button
      type="button"
      className="nav-btn"
      onClick={() => {
        navigate(path);
        closeMenu();
      }}
    >
      {icon} {label}
    </button>
  );

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
          {navBtn('/dashboard', 'My Workouts', <FiCalendar />)}
          {navBtn('/community', "Bruski's Feed", <FiGlobe />)}
          {navBtn('/progress', 'Progress', <FiTrendingUp />)}
          {navBtn('/challenges', 'Challenges', <FiAward />)}
          <button type="button" className="nav-btn active" onClick={closeMenu}>
            <FiActivity /> Tracking
          </button>
          {isAdminUser() && navBtn('/admin', 'Admin', <FiShield />)}
          {navBtn('/profile', 'Profile', <FiUser />)}
        </nav>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          <FiLogOut /> Logout
        </button>
      </div>

      <div className="main-content">
        <header className="tracking-page-header">
          <button type="button" className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <FiMenu size={24} />
          </button>
          <div className="toggle-mobile">
            <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} variant="header" />
          </div>
          <div className="tracking-header-text">
            <h1>Tracking</h1>
            <p className="tracking-subtitle">
              Calorie targets, body weight, water intake, and personal records
            </p>
          </div>
        </header>

        <div className="tracking-tabs">
          <button
            type="button"
            className={`track-tab ${tab === 'calories' ? 'active' : ''}`}
            onClick={() => setTab('calories')}
          >
            <FiZap /> Calories
          </button>
          <button
            type="button"
            className={`track-tab ${tab === 'weight' ? 'active' : ''}`}
            onClick={() => setTab('weight')}
          >
            <FiActivity /> Body Weight
          </button>
          <button
            type="button"
            className={`track-tab ${tab === 'water' ? 'active' : ''}`}
            onClick={() => setTab('water')}
          >
            <FiDroplet /> Water
          </button>
          <button
            type="button"
            className={`track-tab ${tab === 'pr' ? 'active' : ''}`}
            onClick={() => setTab('pr')}
          >
            <FiAward /> PRs
          </button>
        </div>

        {tab === 'weight' && (
          <div className="track-panel">
            <form onSubmit={handleAddWeight} className="track-form">
              <div className="track-form-row">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  placeholder="Weight (kg)"
                  value={weightForm.weight}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || v === '-') {
                      setWeightForm({ ...weightForm, weight: v });
                      return;
                    }
                    const n = parseFloat(v);
                    if (Number.isNaN(n) || n < 0) return;
                    setWeightForm({ ...weightForm, weight: v });
                  }}
                />
                <input
                  type="text"
                  placeholder="Notes"
                  value={weightForm.notes}
                  onChange={(e) => setWeightForm({ ...weightForm, notes: e.target.value })}
                />
                <button type="submit" disabled={loading}>
                  <FiPlus /> Log
                </button>
              </div>
            </form>
            <div className="track-list">
              {weightEntries.map((e) => (
                <div key={e._id} className="track-item water-item">
                  <span>{e.weight} kg</span>
                  <span>{new Date(e.date).toLocaleDateString()}</span>
                  {e.notes && <span className="notes">{e.notes}</span>}
                  <button
                    type="button"
                    className="water-delete-btn"
                    onClick={() => handleDeleteBodyWeight(e._id)}
                    disabled={loading}
                    title="Delete entry"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
              {weightEntries.length === 0 && (
                <p className="empty-msg">No entries yet. Log your first weight!</p>
              )}
            </div>
          </div>
        )}

        {tab === 'water' && (
          <div className="track-panel">
            <div className="water-today">
              <h3>Today: {waterToday.total} ml</h3>
              <div className="water-quick-add">
                {[125, 250, 500, 750].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await trackingAPI.addWater({ amount: amt });
                        fetchWater();
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    +{amt} ml
                  </button>
                ))}
                <input
                  type="number"
                  value={waterForm.amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') {
                      setWaterForm({ amount: 1 });
                      return;
                    }
                    const n = parseInt(v, 10);
                    if (Number.isNaN(n)) return;
                    setWaterForm({ amount: Math.max(1, Math.min(2000, n)) });
                  }}
                  min={1}
                  max={2000}
                />
                <button type="button" onClick={handleAddWater} disabled={loading}>
                  Add
                </button>
              </div>
            </div>
            <div className="track-list">
              {waterToday.entries?.map((e) => (
                <div key={e._id} className="track-item water-item">
                  <span>+{e.amount} ml</span>
                  <button
                    type="button"
                    className="water-delete-btn"
                    onClick={() => handleDeleteWater(e._id)}
                    disabled={loading}
                    title="Delete entry"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'pr' && (
          <div className="track-panel">
            <form onSubmit={handleAddPR} className="track-form pr-form">
              <div className="pr-form-section">
                <label className="pr-input-label">Exercise</label>
                {workoutExercises.length > 0 ? (
                  <div className="exercise-dropdown pr-exercise-dropdown" ref={exerciseDropdownRef}>
                      <button
                        type="button"
                        className={`exercise-dropdown-trigger ${exerciseDropdownOpen ? 'open' : ''}`}
                        onClick={() => setExerciseDropdownOpen((o) => !o)}
                        aria-expanded={exerciseDropdownOpen}
                        aria-haspopup="listbox"
                      >
                        <span className={`exercise-dropdown-label ${(!prForm.exerciseName || (prForm.exerciseName === '__other__' && !prCustomExercise)) ? 'placeholder' : ''}`}>
                          {prForm.exerciseName === '__other__'
                            ? prCustomExercise || 'Other (type below)'
                            : prForm.exerciseName || 'Select exercise'}
                        </span>
                        <FiChevronDown className={`exercise-dropdown-chevron ${exerciseDropdownOpen ? 'open' : ''}`} />
                      </button>
                      {exerciseDropdownOpen && (
                        <ul className="exercise-dropdown-list" role="listbox">
                          {workoutExercises.map((name) => (
                            <li
                              key={name}
                              role="option"
                              aria-selected={prForm.exerciseName === name}
                              className={`exercise-dropdown-option ${prForm.exerciseName === name ? 'selected' : ''}`}
                              onClick={() => {
                                setPRForm({ ...prForm, exerciseName: name });
                                setExerciseDropdownOpen(false);
                              }}
                            >
                              {name}
                            </li>
                          ))}
                          <li
                            role="option"
                            aria-selected={prForm.exerciseName === '__other__'}
                            className={`exercise-dropdown-option exercise-dropdown-other ${prForm.exerciseName === '__other__' ? 'selected' : ''}`}
                            onClick={() => {
                              setPRForm({ ...prForm, exerciseName: '__other__' });
                              setExerciseDropdownOpen(false);
                            }}
                          >
                            Other (type below)
                          </li>
                        </ul>
                      )}
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Exercise name"
                    value={prForm.exerciseName}
                    onChange={(e) => setPRForm({ ...prForm, exerciseName: e.target.value })}
                    className="pr-form-input"
                  />
                )}
              </div>
              {workoutExercises.length > 0 && prForm.exerciseName === '__other__' && (
                <div className="pr-form-section">
                  <label htmlFor="pr-custom-exercise" className="pr-input-label">Custom exercise</label>
                  <input
                    id="pr-custom-exercise"
                    type="text"
                    placeholder="Type exercise name"
                    value={prCustomExercise}
                    onChange={(e) => setPrCustomExercise(e.target.value)}
                    className="pr-form-input"
                  />
                </div>
              )}
              <div className="pr-form-row">
                <div className="pr-input-group">
                  <label htmlFor="pr-weight" className="pr-input-label">Weight (kg)</label>
                  <input
                    id="pr-weight"
                    type="number"
                    step="0.5"
                    min={0}
                    placeholder="0"
                    value={prForm.weight}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || v === '-') {
                      setPRForm({ ...prForm, weight: v });
                      return;
                    }
                    const n = parseFloat(v);
                    if (!Number.isNaN(n) && n < 0) return;
                    setPRForm({ ...prForm, weight: v });
                  }}
                  className="pr-form-input"
                  />
                </div>
                <div className="pr-input-group">
                  <label htmlFor="pr-reps" className="pr-input-label">Reps</label>
                  <input
                    id="pr-reps"
                    type="number"
                    min={1}
                    placeholder="1"
                    value={prForm.reps}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') {
                      setPRForm({ ...prForm, reps: '1' });
                      return;
                    }
                    const n = parseInt(v, 10);
                    if (Number.isNaN(n) || n < 1) return;
                    setPRForm({ ...prForm, reps: v });
                  }}
                  className="pr-form-input"
                  />
                </div>
                <button type="submit" className="pr-add-btn" disabled={loading}>
                  <FiPlus /> Add PR
                </button>
              </div>
            </form>
            <div className="track-list pr-list">
              {prs.map((e) => (
                <div key={e._id} className="track-item pr-item" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{e.exerciseName}</strong> — {e.weight} {e.unit || 'kg'} × {e.reps} reps
                    <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)' }}>
                      {new Date(e.date).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="water-delete-btn"
                    onClick={() => handleDeletePR(e._id)}
                    disabled={loading}
                    title="Delete PR"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
              {prs.length === 0 && (
                <p className="empty-msg">No PRs yet. Log your first record!</p>
              )}
            </div>
          </div>
        )}

        {tab === 'calories' && <CaloriesCalculatorPanel />}
      </div>

    </div>
  );
};

export default Tracking;
