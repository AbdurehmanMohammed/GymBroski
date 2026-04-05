import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FiCalendar,
  FiTrendingUp,
  FiUser,
  FiLogOut,
  FiGlobe,
  FiAward,
  FiActivity,
  FiShield,
  FiTrash2,
  FiRefreshCw,
  FiSearch,
  FiDownload,
  FiExternalLink,
  FiEdit3,
  FiMoon,
  FiSun,
  FiZap,
  FiSlash,
  FiLayers,
  FiCamera,
  FiLock,
  FiSliders,
} from 'react-icons/fi';
import 'bootstrap/dist/css/bootstrap.min.css';
import { adminAPI } from '../services/api';
import { isAdminUser } from '../utils/authRole';
import { ADMIN_REFRESH_EVENT } from '../constants/socketEvents';
import { subscribeSocketConnected } from '../utils/socketLiveStore';
import './Admin.css';

const STAT_ITEMS = [
  ['Users', 'userCount'],
  ['Admins', 'adminCount'],
  ['Suspended', 'suspendedCount'],
  ['Workout templates', 'workoutCount'],
  ['Sessions', 'sessionCount'],
  ['Chat messages', 'messageCount'],
  ['Conversations', 'conversationCount'],
  ['Progress photos', 'progressPhotoCount'],
  ['Weight entries', 'bodyWeightCount'],
  ['Water logs', 'waterIntakeCount'],
  ['Personal records', 'personalRecordCount'],
];

function formatJoined(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatFeedTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function displayInitials(name) {
  if (!name || !String(name).trim()) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function downloadUsersCsv(rows) {
  const header = ['email', 'username', 'name', 'role', 'suspended', 'points', 'createdAt'];
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [header.join(',')].concat(
    rows.map((u) =>
      [
        u.email,
        u.username || '',
        u.name,
        u.role,
        u.suspended ? 'yes' : 'no',
        u.points ?? 0,
        u.createdAt ? new Date(u.createdAt).toISOString() : '',
      ]
        .map(esc)
        .join(',')
    )
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gymbruski-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const Admin = ({ theme = 'light', onToggleTheme }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState({ recentSignups: [], messagesLast24h: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pointsEdit, setPointsEdit] = useState(null);
  const [live, setLive] = useState(false);
  const [manageUserId, setManageUserId] = useState(null);
  const [manageLoad, setManageLoad] = useState(false);
  const [manageErr, setManageErr] = useState('');
  const [manageUsername, setManageUsername] = useState('');
  const [manageSummary, setManageSummary] = useState(null);
  const [manageForm, setManageForm] = useState(null);
  const [pwdNew, setPwdNew] = useState('');
  const [pwdNew2, setPwdNew2] = useState('');
  const [manageSaving, setManageSaving] = useState(false);
  const [manageIsPlatformAdmin, setManageIsPlatformAdmin] = useState(false);
  const [manageSuspended, setManageSuspended] = useState(false);
  const [manageTab, setManageTab] = useState('overview');
  const [chatClearing, setChatClearing] = useState(false);
  const refreshTimer = useRef(null);

  const navTo = (path) => navigate(path);

  const loadActivity = useCallback(async () => {
    try {
      const data = await adminAPI.getActivity();
      setActivity({
        recentSignups: data.recentSignups || [],
        messagesLast24h: data.messagesLast24h ?? 0,
      });
    } catch {
      /* optional */
    }
  }, []);

  const load = useCallback(async (opts = {}) => {
    const quiet = opts.quiet === true;
    setError('');
    if (!quiet) setLoading(true);
    try {
      const [s, u] = await Promise.all([adminAPI.getStats(), adminAPI.getUsers()]);
      setStats(s.stats);
      setUsers(u.users || []);
    } catch (e) {
      if (!quiet) {
        setError(e.message || 'Failed to load admin data');
        setStats(null);
        setUsers([]);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdminUser()) {
      navigate('/dashboard', { replace: true });
      return;
    }
    load();
    loadActivity();
  }, [load, loadActivity, navigate]);

  useEffect(() => {
    if (!isAdminUser()) return undefined;
    const unsubLive = subscribeSocketConnected(setLive);
    const onAdminRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        load({ quiet: true });
        loadActivity();
      }, 60);
    };
    window.addEventListener(ADMIN_REFRESH_EVENT, onAdminRefresh);
    return () => {
      unsubLive();
      window.removeEventListener(ADMIN_REFRESH_EVENT, onAdminRefresh);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [load, loadActivity]);

  useEffect(() => {
    if (manageUserId) setManageTab('overview');
  }, [manageUserId]);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (roleFilter === 'admin') list = list.filter((u) => u.role === 'admin');
    if (roleFilter === 'user') list = list.filter((u) => u.role !== 'admin');
    if (statusFilter === 'suspended') list = list.filter((u) => u.suspended);
    if (statusFilter === 'active') list = list.filter((u) => !u.suspended);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => {
      const blob = `${u.email || ''} ${u.username || ''} ${u.name || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [users, query, roleFilter, statusFilter]);

  useEffect(() => {
    if (!manageUserId) {
      setManageForm(null);
      setManageSummary(null);
      setManageUsername('');
      setManageIsPlatformAdmin(false);
      setManageSuspended(false);
      setManageErr('');
      return;
    }
    let cancelled = false;
    (async () => {
      setManageLoad(true);
      setManageErr('');
      try {
        const [du, ds] = await Promise.all([
          adminAPI.getUser(manageUserId),
          adminAPI.getUserSummary(manageUserId),
        ]);
        if (cancelled) return;
        const u = du.user;
        setManageSummary(
          ds.summary || {
            workoutTemplates: 0,
            sessions: 0,
            progressPhotos: 0,
            personalRecords: 0,
          }
        );
        setManageUsername(u.username || '');
        setManageIsPlatformAdmin(Boolean(u.isPlatformAdmin));
        setManageSuspended(Boolean(u.suspended));
        setManageForm({
          name: u.name || '',
          email: u.email || '',
          profilePhoto: u.profilePhoto || '',
          timezone: u.timezone || 'UTC',
          workoutReminderHour: u.workoutReminderHour ?? 8,
          workoutReminderMinute: u.workoutReminderMinute ?? 0,
          emailWorkoutReminders: u.emailWorkoutReminders !== false,
          emailChatNotifications: u.emailChatNotifications !== false,
        });
      } catch (e) {
        if (!cancelled) setManageErr(e.message || 'Failed to load user');
      } finally {
        if (!cancelled) setManageLoad(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manageUserId]);

  const handleRole = async (userId, role) => {
    setBusyId(userId);
    try {
      await adminAPI.setUserRole(userId, role);
      await load({ quiet: true });
    } catch (e) {
      alert(e.message || 'Could not update role');
      await load({ quiet: true });
    } finally {
      setBusyId(null);
    }
  };

  const handleSuspend = async (userId, suspended) => {
    setBusyId(userId);
    try {
      await adminAPI.setUserSuspended(userId, suspended);
      const sid = String(userId);
      setUsers((prev) =>
        prev.map((u) => (String(u.id) === sid ? { ...u, suspended } : u))
      );
      setStats((st) => {
        if (!st) return st;
        const delta = suspended ? 1 : -1;
        const next = Math.max(0, (st.suspendedCount || 0) + delta);
        return { ...st, suspendedCount: next };
      });
      if (String(manageUserId) === sid) setManageSuspended(suspended);
      await load({ quiet: true });
      await loadActivity();
    } catch (e) {
      alert(e.message || 'Could not update suspension');
      await load({ quiet: true });
    } finally {
      setBusyId(null);
    }
  };

  const handleSavePoints = async (userId) => {
    const n = Math.floor(Number(pointsEdit?.value));
    if (!Number.isFinite(n) || n < 0) {
      alert('Enter a valid non-negative integer.');
      return;
    }
    setBusyId(userId);
    try {
      await adminAPI.setUserPoints(userId, n);
      setPointsEdit(null);
      await load({ quiet: true });
    } catch (e) {
      alert(e.message || 'Could not update points');
      await load({ quiet: true });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (userId, email) => {
    if (!window.confirm(`Permanently delete ${email} and all their data? This cannot be undone.`)) {
      return;
    }
    setBusyId(userId);
    const sid = String(userId);
    try {
      await adminAPI.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => String(u.id) !== sid));
      setManageUserId((id) => (id && String(id) === sid ? null : id));
      setPointsEdit((pe) => (pe && String(pe.id) === sid ? null : pe));
      setStats((st) => (st ? { ...st, userCount: Math.max(0, (st.userCount || 0) - 1) } : st));
      await load({ quiet: true });
      await loadActivity();
    } catch (e) {
      alert(e.message || 'Delete failed');
      await load({ quiet: true });
    } finally {
      setBusyId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
    window.location.reload();
  };

  const handleClearAllChat = async () => {
    if (
      !window.confirm(
        'Remove every chat message for all users? Conversations remain (empty). This cannot be undone.'
      )
    ) {
      return;
    }
    if (!window.confirm('Final confirmation: delete all chat history now?')) return;
    setChatClearing(true);
    try {
      const r = await adminAPI.clearAllChat();
      alert(r.message || `Deleted ${r.deletedMessages ?? 0} message(s).`);
      await load({ quiet: true });
      await loadActivity();
    } catch (e) {
      alert(e.message || 'Could not clear chat');
    } finally {
      setChatClearing(false);
    }
  };

  const isStrongPwd = (str) => {
    if (!str || str.length < 8) return false;
    if (!/[A-Z]/.test(str)) return false;
    if (!/[a-z]/.test(str)) return false;
    if (!/[0-9]/.test(str)) return false;
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(str)) return false;
    return true;
  };

  const saveManageProfile = async (e) => {
    e.preventDefault();
    if (!manageUserId || !manageForm) return;
    setManageSaving(true);
    try {
      await adminAPI.updateUserProfile(manageUserId, manageForm);
      await load({ quiet: true });
      alert('Profile saved.');
    } catch (err) {
      alert(err.message || 'Save failed');
    } finally {
      setManageSaving(false);
    }
  };

  const saveManagePassword = async (e) => {
    e.preventDefault();
    if (!manageUserId) return;
    if (pwdNew !== pwdNew2) {
      alert('Passwords do not match.');
      return;
    }
    if (manageIsPlatformAdmin) {
      if (pwdNew.length < 4) {
        alert('Platform admin password must be at least 4 characters.');
        return;
      }
    } else if (!isStrongPwd(pwdNew)) {
      alert(
        'Password must be at least 8 characters with uppercase, lowercase, number, and special character.'
      );
      return;
    }
    setManageSaving(true);
    try {
      await adminAPI.setUserPassword(manageUserId, pwdNew);
      setPwdNew('');
      setPwdNew2('');
      alert('Password updated. Tell the user to sign in with the new password.');
    } catch (err) {
      alert(err.message || 'Failed to set password');
    } finally {
      setManageSaving(false);
    }
  };

  const currentUserId = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}').id;
    } catch {
      return null;
    }
  })();

  const renderDirectoryPoints = (u) =>
    pointsEdit?.id === u.id ? (
      <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="number"
          min={0}
          value={pointsEdit.value}
          onChange={(e) =>
            setPointsEdit((prev) => (prev ? { ...prev, value: e.target.value } : null))
          }
          style={{ width: 72, padding: 4, borderRadius: 6 }}
        />
        <button type="button" className="btn btn-primary btn-sm py-0 px-2" onClick={() => handleSavePoints(u.id)}>
          Save
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2" onClick={() => setPointsEdit(null)}>
          ✕
        </button>
      </span>
    ) : (
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--ac-mono)' }}>{u.points ?? 0}</span>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm py-0 px-2"
          disabled={busyId === u.id}
          onClick={() => setPointsEdit({ id: u.id, value: String(u.points ?? 0) })}
        >
          Edit
        </button>
      </span>
    );

  const renderDirectoryActions = (u) => (
    <div className="admin-console__actions d-flex flex-wrap gap-1 align-items-center">
      <button
        type="button"
        className="btn btn-outline-primary btn-sm py-0 px-2"
        disabled={busyId === u.id}
        onClick={() => setManageUserId(u.id)}
      >
        <FiEdit3 size={12} className="me-1" style={{ verticalAlign: 'middle' }} />
        Manage
      </button>
      <Link className="btn btn-link btn-sm p-0 align-baseline text-decoration-none" to={`/profile/${u.id}`}>
        Profile <FiExternalLink size={12} />
      </Link>
      {!u.isPlatformAdmin && (
        <>
          {u.suspended ? (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm py-0 px-2"
              disabled={busyId === u.id}
              onClick={() => handleSuspend(u.id, false)}
            >
              <FiSlash size={12} /> Unsuspend
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm py-0 px-2"
              disabled={busyId === u.id || String(u.id) === String(currentUserId)}
              onClick={() => handleSuspend(u.id, true)}
            >
              Suspend
            </button>
          )}
        </>
      )}
      {u.isPlatformAdmin ? (
        <span style={{ fontSize: 11, color: 'var(--ac-muted)' }} title="Platform admin">
          —
        </span>
      ) : u.role !== 'admin' ? (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm py-0 px-2"
          disabled={busyId === u.id}
          onClick={() => handleRole(u.id, 'admin')}
        >
          Make admin
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm py-0 px-2"
          disabled={busyId === u.id}
          onClick={() => handleRole(u.id, 'user')}
        >
          Demote
        </button>
      )}
      <button
        type="button"
        className="btn btn-outline-danger btn-sm py-0 px-2"
        disabled={
          busyId === u.id || String(u.id) === String(currentUserId) || u.isPlatformAdmin
        }
        onClick={() => handleDelete(u.id, u.email)}
      >
        <FiTrash2 size={12} /> Delete
      </button>
    </div>
  );

  const RailBtn = ({ path, icon: Icon, active, label }) => (
    <button
      type="button"
      className={`admin-console__rail-btn${active ? ' admin-console__rail-btn--active' : ''}`}
      onClick={() => navTo(path)}
      title={label}
      aria-label={label}
    >
      <Icon size={22} />
    </button>
  );

  const bsTheme = theme === 'dark' ? 'dark' : 'light';

  return (
    <div
      className={`admin-console d-flex min-vh-100 admin-console--bs ${theme === 'light' ? 'admin-console--light' : 'admin-console--dark'}`}
      data-bs-theme={bsTheme}
    >
      <aside className="admin-console__rail" aria-label="Admin navigation">
        <div className="admin-console__mark">OP</div>
        <nav className="admin-console__rail-nav">
          <RailBtn path="/dashboard" icon={FiCalendar} label="My Workouts" />
          <RailBtn path="/community" icon={FiGlobe} label="Bruski's Feed" />
          <RailBtn path="/progress" icon={FiTrendingUp} label="Progress" />
          <RailBtn path="/challenges" icon={FiAward} label="Challenges" />
          <RailBtn path="/tracking" icon={FiActivity} label="Tracking" />
          <RailBtn path="/profile" icon={FiUser} label="Profile" />
          <button
            type="button"
            className="admin-console__rail-btn admin-console__rail-btn--active"
            title="Command center"
            aria-current="page"
          >
            <FiShield size={22} />
          </button>
        </nav>
        <button
          type="button"
          className="admin-console__rail-btn admin-console__rail-logout"
          onClick={handleLogout}
          title="Logout"
          aria-label="Logout"
        >
          <FiLogOut size={22} />
        </button>
      </aside>

      <main className="admin-console__main flex-grow-1 min-w-0">
        <div className="container-fluid px-0 px-md-1">
          <div className="admin-console__top row align-items-start g-3 mb-3">
            <div className="admin-console__title-block col-12 col-lg">
              <h1 className="mb-2">Command center</h1>
              <p className="mb-0 small text-secondary">
                Bootstrap layout + live Socket.io. Delete/suspend ends the member&apos;s session immediately when their
                browser has this app open. Toggle sun/moon for light or dark admin theme.
              </p>
            </div>
            <div className="col-12 col-lg-auto d-flex flex-wrap gap-2 align-items-center justify-content-lg-end">
              <span
                className={`badge rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2 admin-console__live-pill ${live ? 'text-bg-success' : 'text-bg-secondary'}`}
              >
                <span className={`admin-console__live-dot ${live ? 'admin-console__live-dot--on' : ''}`} aria-hidden />
                {live ? 'Live sync' : 'Offline'}
              </span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                onClick={() => onToggleTheme?.()}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
                <span className="d-none d-sm-inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger border-0 shadow-sm" role="alert">
              {error}
            </div>
          )}

          <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
            <button
              type="button"
              className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
              onClick={() => load()}
              disabled={loading}
            >
              <FiRefreshCw size={16} /> Refresh
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
              onClick={() => downloadUsersCsv(users)}
              disabled={!users.length}
            >
              <FiDownload size={16} /> Export CSV
            </button>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
              onClick={handleClearAllChat}
              disabled={loading || chatClearing}
              title="Deletes all messages platform-wide"
            >
              <FiTrash2 size={16} /> Clear all chat
            </button>
            {stats?.serverTime && (
              <small className="text-secondary ms-auto font-monospace">
                Server {new Date(stats.serverTime).toLocaleString()}
              </small>
            )}
          </div>

          {stats && (
            <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-6 g-2 mb-4">
              {STAT_ITEMS.map(([label, key]) => (
                <div key={key} className="col">
                  <div
                    className={`card h-100 border-0 shadow-sm admin-console__stat-card${key === 'suspendedCount' ? ' admin-console__stat-card--warn' : ''}`}
                  >
                    <div className="card-body py-3 px-3">
                      <div className="text-uppercase small text-secondary fw-semibold mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.06em' }}>
                        {label}
                      </div>
                      <div className="fs-4 fw-bold font-monospace admin-console__stat-card-value">{stats[key] ?? '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="row g-3">
            <div className="col-lg-4">
              <div className="card border-0 shadow-sm h-100 admin-console__panel-card">
                <div className="card-body">
                  <h2 className="h6 text-warning d-flex align-items-center gap-2 mb-3">
                    <FiZap aria-hidden />
                    Activity (7d)
                  </h2>
                  <p className="small text-secondary mb-3">
                    Chat messages (24h):{' '}
                    <strong className="text-warning font-monospace">{activity.messagesLast24h}</strong>
                  </p>
                  <div className="admin-console__feed d-flex flex-column gap-2" style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {activity.recentSignups.length === 0 && (
                      <span className="text-secondary small">No recent signups.</span>
                    )}
                    {activity.recentSignups.map((row) => (
                      <div key={row.id} className="admin-console__feed-row rounded-3 p-2 small">
                        <div className="d-flex justify-content-between gap-2">
                          <span>
                            <strong>{row.name}</strong>
                            <br />
                            <span className="text-secondary">{row.email}</span>
                            {row.suspended && (
                              <span className="badge text-bg-danger ms-2">suspended</span>
                            )}
                          </span>
                          <small className="text-secondary text-nowrap font-monospace">{formatFeedTime(row.createdAt)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-8">
              <div className="row g-2 align-items-center mb-3">
                <div className="col-12 col-md">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-body-secondary border-secondary-subtle">
                      <FiSearch size={16} className="text-secondary" aria-hidden />
                    </span>
                    <input
                      type="search"
                      className="form-control border-secondary-subtle"
                      placeholder="Search name, email, username…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-6 col-md-auto">
                  <select
                    className="form-select form-select-sm border-secondary-subtle"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    aria-label="Filter by role"
                  >
                    <option value="all">All roles</option>
                    <option value="admin">Admins</option>
                    <option value="user">Users</option>
                  </select>
                </div>
                <div className="col-6 col-md-auto">
                  <select
                    className="form-select form-select-sm border-secondary-subtle"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter by status"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active only</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="col-12 col-md-auto">
                  <small className="text-secondary">
                    {filteredUsers.length} / {users.length}
                  </small>
                </div>
              </div>

              {loading ? (
                <p className="text-secondary small">Loading directory…</p>
              ) : (
                <div className="card border-0 shadow-sm admin-console__table-card">
                  {!filteredUsers.length ? (
                    <p className="text-center text-secondary small py-4 mb-0 px-3">No rows match.</p>
                  ) : (
                    <>
                      <div className="admin-console__user-cards d-lg-none" role="list">
                        {filteredUsers.map((u) => (
                          <article key={u.id} className="admin-console__user-card" role="listitem">
                            <div className="admin-console__user-card-head">
                              <div className="admin-console__user-card-identity">
                                <span className="admin-console__user-card-name">{u.name || '—'}</span>
                                <span
                                  className={`admin-console__badge ${
                                    u.role === 'admin' ? 'admin-console__badge--admin' : 'admin-console__badge--user'
                                  }`}
                                >
                                  {u.role}
                                </span>
                                {u.suspended ? (
                                  <span className="admin-console__badge admin-console__badge--suspended">blocked</span>
                                ) : null}
                              </div>
                              <span className="admin-console__user-card-meta text-secondary small">
                                {formatJoined(u.createdAt)}
                              </span>
                            </div>
                            {u.email ? (
                              <a href={`mailto:${u.email}`} className="admin-console__user-card-email" title={u.email}>
                                {u.email}
                              </a>
                            ) : (
                              <span className="admin-console__user-card-email text-secondary">—</span>
                            )}
                            {u.username ? (
                              <div className="admin-console__user-card-username font-monospace small text-secondary">
                                @{u.username}
                              </div>
                            ) : null}
                            <div className="admin-console__user-card-row">
                              <span className="text-secondary small">Points</span>
                              <div className="admin-console__user-card-points">{renderDirectoryPoints(u)}</div>
                            </div>
                            <div className="admin-console__user-card-actions">{renderDirectoryActions(u)}</div>
                          </article>
                        ))}
                      </div>
                      <div className="d-none d-lg-block">
                        <div className="table-responsive">
                          <table className="table table-sm table-hover align-middle mb-0 admin-console__table">
                            <thead>
                              <tr>
                                <th>Contact</th>
                                <th>Name</th>
                                <th>Joined</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Points</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredUsers.map((u) => (
                                <tr key={u.id}>
                                  <td className="admin-console__table-contact">
                                    <div className="admin-console__contact-email" title={u.email}>
                                      {u.email}
                                    </div>
                                    {u.username ? (
                                      <div className="admin-console__contact-user text-secondary small font-monospace">
                                        @{u.username}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td>{u.name}</td>
                                  <td className="text-nowrap">{formatJoined(u.createdAt)}</td>
                                  <td>
                                    <span
                                      className={`admin-console__badge ${
                                        u.role === 'admin' ? 'admin-console__badge--admin' : 'admin-console__badge--user'
                                      }`}
                                    >
                                      {u.role}
                                    </span>
                                  </td>
                                  <td>
                                    {u.suspended ? (
                                      <span className="admin-console__badge admin-console__badge--suspended">
                                        blocked
                                      </span>
                                    ) : (
                                      <span className="text-secondary small">ok</span>
                                    )}
                                  </td>
                                  <td>{renderDirectoryPoints(u)}</td>
                                  <td>{renderDirectoryActions(u)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <nav className="admin-console__mobile-bar" aria-label="Mobile navigation">
        <RailBtn path="/dashboard" icon={FiCalendar} label="Workouts" />
        <RailBtn path="/community" icon={FiGlobe} label="Feed" />
        <RailBtn path="/profile" icon={FiUser} label="Profile" />
        <button type="button" className="admin-console__rail-btn admin-console__rail-btn--active" aria-label="Admin">
          <FiShield size={22} />
        </button>
      </nav>

      {manageUserId && (
        <div
          className="admin-console__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ac-modal-title"
          data-bs-theme={bsTheme}
          onClick={(e) => e.target === e.currentTarget && setManageUserId(null)}
        >
          <div
            className="admin-console__modal admin-console__modal--wide"
            data-bs-theme={bsTheme}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="admin-console__modal-close"
              onClick={() => setManageUserId(null)}
              aria-label="Close"
            >
              ✕
            </button>

            {manageLoad && <p className="admin-console__modal-loading">Loading member…</p>}
            {manageErr && <p className="admin-console__modal-error">{manageErr}</p>}

            {!manageLoad && !manageErr && manageForm && (
              <>
                <header className="admin-console__modal-head">
                  <div className="admin-console__modal-avatar" aria-hidden>
                    {displayInitials(manageForm.name)}
                  </div>
                  <div className="admin-console__modal-head-text">
                    <h2 id="ac-modal-title">Member studio</h2>
                    <p className="admin-console__modal-sub">
                      {manageForm.name}
                      <span className="admin-console__modal-sub-dot">·</span>
                      <span className="admin-console__modal-sub-email">{manageForm.email}</span>
                    </p>
                    {manageUsername && (
                      <p className="admin-console__modal-login-hint">
                        Signs in as <strong>{manageUsername}</strong>
                      </p>
                    )}
                  </div>
                </header>

                <div className="admin-console__modal-tabs" role="tablist" aria-label="Member sections">
                  {[
                    { id: 'overview', label: 'Overview', icon: FiShield },
                    { id: 'profile', label: 'Profile', icon: FiSliders },
                    { id: 'security', label: 'Security', icon: FiLock },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={manageTab === id}
                      className={`admin-console__modal-tab${manageTab === id ? ' admin-console__modal-tab--active' : ''}`}
                      onClick={() => setManageTab(id)}
                    >
                      <Icon size={15} aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="admin-console__modal-body">
                  {manageTab === 'overview' && (
                    <>
                      <div className="admin-console__chip-grid">
                        <div className="admin-console__chip">
                          <FiLayers className="admin-console__chip-icon" aria-hidden />
                          <span className="admin-console__chip-value">{manageSummary?.workoutTemplates ?? 0}</span>
                          <span className="admin-console__chip-label">Templates</span>
                        </div>
                        <div className="admin-console__chip">
                          <FiActivity className="admin-console__chip-icon" aria-hidden />
                          <span className="admin-console__chip-value">{manageSummary?.sessions ?? 0}</span>
                          <span className="admin-console__chip-label">Sessions</span>
                        </div>
                        <div className="admin-console__chip">
                          <FiCamera className="admin-console__chip-icon" aria-hidden />
                          <span className="admin-console__chip-value">{manageSummary?.progressPhotos ?? 0}</span>
                          <span className="admin-console__chip-label">Photos</span>
                        </div>
                        <div className="admin-console__chip">
                          <FiTrendingUp className="admin-console__chip-icon" aria-hidden />
                          <span className="admin-console__chip-value">{manageSummary?.personalRecords ?? 0}</span>
                          <span className="admin-console__chip-label">PRs</span>
                        </div>
                      </div>

                      {!manageIsPlatformAdmin && String(manageUserId) !== String(currentUserId) && (
                        <section className="admin-console__sheet admin-console__sheet--accent">
                          <h3 className="admin-console__sheet-title">
                            <FiSlash size={16} aria-hidden />
                            Access control
                          </h3>
                          <p className="admin-console__sheet-lead">
                            Suspend blocks sign-in and API access instantly on their open sessions (Socket.io).
                          </p>
                          {manageSuspended ? (
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              disabled={manageSaving || busyId === manageUserId}
                              onClick={() => handleSuspend(manageUserId, false)}
                            >
                              Lift suspension
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              disabled={manageSaving || busyId === manageUserId}
                              onClick={() => handleSuspend(manageUserId, true)}
                            >
                              Suspend account
                            </button>
                          )}
                        </section>
                      )}
                    </>
                  )}

                  {manageTab === 'profile' && (
                    <form className="admin-console__modal-form" onSubmit={saveManageProfile}>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label small text-uppercase text-secondary fw-semibold" htmlFor="ac-name">
                            Display name
                          </label>
                          <input
                            id="ac-name"
                            className="form-control form-control-sm"
                            autoComplete="name"
                            value={manageForm.name}
                            onChange={(e) => setManageForm((f) => (f ? { ...f, name: e.target.value } : f))}
                            required
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small text-uppercase text-secondary fw-semibold" htmlFor="ac-email">
                            Email
                          </label>
                          <input
                            id="ac-email"
                            className="form-control form-control-sm"
                            type="email"
                            autoComplete="email"
                            value={manageForm.email}
                            onChange={(e) => setManageForm((f) => (f ? { ...f, email: e.target.value } : f))}
                            required
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label small text-uppercase text-secondary fw-semibold" htmlFor="ac-photo">
                            Profile photo URL
                          </label>
                          <input
                            id="ac-photo"
                            className="form-control form-control-sm"
                            value={manageForm.profilePhoto}
                            onChange={(e) => setManageForm((f) => (f ? { ...f, profilePhoto: e.target.value } : f))}
                            placeholder="https://…"
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label small text-uppercase text-secondary fw-semibold" htmlFor="ac-tz">
                            Timezone
                          </label>
                          <input
                            id="ac-tz"
                            className="form-control form-control-sm"
                            value={manageForm.timezone}
                            onChange={(e) => setManageForm((f) => (f ? { ...f, timezone: e.target.value } : f))}
                          />
                        </div>
                        <div className="col-6">
                          <label className="form-label small text-uppercase text-secondary fw-semibold" htmlFor="ac-rh">
                            Reminder hour
                          </label>
                          <input
                            id="ac-rh"
                            className="form-control form-control-sm"
                            type="number"
                            min={0}
                            max={23}
                            value={manageForm.workoutReminderHour}
                            onChange={(e) =>
                              setManageForm((f) =>
                                f ? { ...f, workoutReminderHour: parseInt(e.target.value, 10) || 0 } : f
                              )
                            }
                          />
                        </div>
                        <div className="col-6">
                          <label className="form-label small text-uppercase text-secondary fw-semibold" htmlFor="ac-rm">
                            Reminder minute
                          </label>
                          <input
                            id="ac-rm"
                            className="form-control form-control-sm"
                            type="number"
                            min={0}
                            max={59}
                            value={manageForm.workoutReminderMinute}
                            onChange={(e) =>
                              setManageForm((f) =>
                                f ? { ...f, workoutReminderMinute: parseInt(e.target.value, 10) || 0 } : f
                              )
                            }
                          />
                        </div>
                      </div>
                      <div className="form-check mt-3">
                        <input
                          id="ac-rem"
                          className="form-check-input"
                          type="checkbox"
                          checked={manageForm.emailWorkoutReminders}
                          onChange={(e) =>
                            setManageForm((f) => (f ? { ...f, emailWorkoutReminders: e.target.checked } : f))
                          }
                        />
                        <label className="form-check-label" htmlFor="ac-rem">
                          Workout reminder emails
                        </label>
                      </div>
                      <div className="form-check mb-2">
                        <input
                          id="ac-chat"
                          className="form-check-input"
                          type="checkbox"
                          checked={manageForm.emailChatNotifications}
                          onChange={(e) =>
                            setManageForm((f) => (f ? { ...f, emailChatNotifications: e.target.checked } : f))
                          }
                        />
                        <label className="form-check-label" htmlFor="ac-chat">
                          Chat email notifications
                        </label>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-success w-100 mt-2"
                        disabled={manageSaving}
                      >
                        Save profile
                      </button>
                    </form>
                  )}

                  {manageTab === 'security' && (
                    <div className="admin-console__modal-stack">
                      <form className="admin-console__modal-form" onSubmit={saveManagePassword}>
                        <section className="admin-console__sheet">
                          <h3 className="admin-console__sheet-title">
                            <FiLock size={16} aria-hidden />
                            Set password
                          </h3>
                          <p className="admin-console__sheet-lead">
                            {manageIsPlatformAdmin
                              ? 'Platform admin: at least 4 characters (no symbol rules).'
                              : 'Members need a strong password: 8+ chars, upper, lower, number, symbol.'}
                          </p>
                          <div className="row g-2">
                            <div className="col-12">
                              <label className="form-label small text-uppercase text-secondary fw-semibold" htmlFor="ac-p1">
                                New password
                              </label>
                              <input
                                id="ac-p1"
                                className="form-control form-control-sm"
                                type="password"
                                value={pwdNew}
                                onChange={(e) => setPwdNew(e.target.value)}
                                autoComplete="new-password"
                              />
                            </div>
                            <div className="col-12">
                              <label className="form-label small text-uppercase text-secondary fw-semibold" htmlFor="ac-p2">
                                Confirm
                              </label>
                              <input
                                id="ac-p2"
                                className="form-control form-control-sm"
                                type="password"
                                value={pwdNew2}
                                onChange={(e) => setPwdNew2(e.target.value)}
                                autoComplete="new-password"
                              />
                            </div>
                          </div>
                          <button
                            type="submit"
                            className="btn btn-primary w-100 mt-3"
                            disabled={manageSaving}
                          >
                            Update password
                          </button>
                        </section>
                      </form>

                      {!manageIsPlatformAdmin && String(manageUserId) !== String(currentUserId) && (
                        <section className="admin-console__sheet admin-console__sheet--danger-zone">
                          <h3 className="admin-console__sheet-title">
                            <FiTrash2 size={16} aria-hidden />
                            Remove member
                          </h3>
                          <p className="admin-console__sheet-lead">
                            Deletes the account and all related data. Their open sessions are closed immediately via
                            Socket.io.
                          </p>
                          <button
                            type="button"
                            className="btn btn-danger w-100"
                            disabled={busyId === manageUserId}
                            onClick={() => handleDelete(manageUserId, manageForm.email)}
                          >
                            Delete this account
                          </button>
                        </section>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
