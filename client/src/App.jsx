import './App.css';
import { useState, useEffect } from 'react';
import {
  BrowserRouter as AppRouter,
  Routes,
  Route,
  Navigate,
  useSearchParams,
} from 'react-router-dom';
import { FaEnvelope, FaLock, FaUser } from 'react-icons/fa';
import { authAPI, profileAPI } from './services/api';
import BrandLogo from './components/BrandLogo';
import Admin from './components/Admin';
import Dashboard from './components/Dashboard';
import PublicWorkouts from './components/PublicWorkouts';
import Progress from './components/Progress';
import Profile from './components/Profile';
import UserProfile from './components/UserProfile';
import Tracking from './components/Tracking';
import Challenges from './components/Challenges';
import ThemeToggle from './components/ThemeToggle';
import ChatNotificationListener from './components/ChatNotificationListener';
import SessionSocketBridge from './components/SessionSocketBridge';
import Iridescence from './components/Iridescence';
import DarkVeil from './components/DarkVeil';

// Login/Register component
const SESSION_MESSAGES = {
  removed: 'This account was removed. You can sign in with another account if you have one.',
  suspended: 'This account was suspended. Contact an administrator if you think this is a mistake.',
  ended: 'Your session was ended. Please sign in again.',
};

function isLikelyJwt(token) {
  return (
    typeof token === 'string' &&
    token.length > 30 &&
    token.split('.').length === 3
  );
}

const AuthPage = ({ isLogin, setIsLogin, theme, onToggleTheme }) => {
  const [searchParams] = useSearchParams();
  const sessionNotice = searchParams.get('session');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const isStrongPassword = (str) => {
    if (!str || str.length < 8) return false;
    if (!/[A-Z]/.test(str)) return false;
    if (!/[a-z]/.test(str)) return false;
    if (!/[0-9]/.test(str)) return false;
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(str)) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isLogin && !isStrongPassword(formData.password)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number, and special character (!@#$%^&*).');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const response = await authAPI.login({
          email: formData.email,
          password: formData.password,
          rememberMe
        });
        if (!isLikelyJwt(response?.token) || !response?.user || typeof response.user !== 'object') {
          setError('Invalid response from server. Please try again.');
          return;
        }
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        try {
          const prof = await profileAPI.getProfile();
          const { success: _s, ...profRest } = prof;
          localStorage.setItem(
            'user',
            JSON.stringify({
              ...response.user,
              ...profRest,
              id: response.user.id,
            })
          );
        } catch {
          /* keep slim user from login */
        }
        setSuccess('Login successful! Redirecting...');
        window.setTimeout(() => {
          window.location.replace(`${window.location.origin}/dashboard`);
        }, 150);
      } else {
        const response = await authAPI.register({
          ...formData,
          rememberMe
        });
        if (!isLikelyJwt(response?.token) || !response?.user || typeof response.user !== 'object') {
          setError('Invalid response from server. Please try again.');
          return;
        }
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        try {
          const prof = await profileAPI.getProfile();
          const { success: _s, ...profRest } = prof;
          localStorage.setItem(
            'user',
            JSON.stringify({
              ...response.user,
              ...profRest,
              id: response.user.id,
            })
          );
        } catch {
          /* keep slim user */
        }
        setSuccess('Registration successful! Redirecting...');
        window.setTimeout(() => {
          window.location.replace(`${window.location.origin}/dashboard`);
        }, 150);
      }
    } catch (err) {
      console.error('Full error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const isDark = theme === 'dark';

  return (
    <div
      style={{
        ...styles.container,
        ...(isDark ? styles.containerDarkAurora : styles.containerLightAurora),
      }}
    >
      <div
        className={isDark ? 'auth-card auth-card--dark' : 'auth-card auth-card--aurora'}
        style={{
          ...styles.card,
          ...(isDark ? styles.cardDark : {})
        }}
      >
        <div style={styles.cardHeaderRow}>
          <div />
          <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} variant="auth" />
        </div>
        <div style={styles.logoContainer}>
          <BrandLogo variant="auth" />
          <h1 className="sr-only">GymBroski</h1>
          <p style={{ ...styles.subtitle, ...(isDark ? { color: '#94a3b8' } : {}) }}>
            Track. Train. Transform.
          </p>
        </div>

        {sessionNotice && SESSION_MESSAGES[sessionNotice] && (
          <div
            role="alert"
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              marginBottom: 16,
              fontSize: 14,
              lineHeight: 1.45,
              border: '1px solid',
              ...(sessionNotice === 'suspended'
                ? {
                    borderColor: 'rgba(251, 191, 36, 0.45)',
                    background: isDark ? 'rgba(120, 53, 15, 0.35)' : '#fffbeb',
                    color: isDark ? '#fde68a' : '#92400e',
                  }
                : {
                    borderColor: isDark ? 'rgba(248, 113, 113, 0.4)' : '#fc8181',
                    background: isDark ? 'rgba(127, 29, 29, 0.35)' : '#fed7d7',
                    color: isDark ? '#fecaca' : '#c53030',
                  }),
            }}
          >
            {SESSION_MESSAGES[sessionNotice]}
          </div>
        )}

        <div
          className={`auth-toggle-row${isDark ? ' auth-toggle-row--dark' : ''}`}
        >
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={`auth-tab-btn ${isLogin ? 'auth-tab-btn--active' : 'auth-tab-btn--inactive'}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={`auth-tab-btn ${!isLogin ? 'auth-tab-btn--active' : 'auth-tab-btn--inactive'}`}
          >
            Register
          </button>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            {error}
          </div>
        )}
        {success && (
          <div style={styles.successAlert}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {!isLogin && (
            <div style={styles.inputGroup}>
              <label style={{ ...styles.label, ...(isDark ? styles.labelDark : {}) }}>Full Name</label>
              <div style={styles.inputContainer}>
                <FaUser style={{ ...styles.inputIcon, ...(isDark ? styles.inputIconDark : {}) }} />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="auth-input-field"
                  style={{ ...styles.input, ...(isDark ? styles.inputDark : {}) }}
                  placeholder="Tim Doe"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={{ ...styles.label, ...(isDark ? styles.labelDark : {}) }}>
              {isLogin ? 'Email or admin username' : 'Email Address'}
            </label>
            <div style={styles.inputContainer}>
              <FaEnvelope style={{ ...styles.inputIcon, ...(isDark ? styles.inputIconDark : {}) }} />
              <input
                type={isLogin ? 'text' : 'email'}
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="auth-input-field"
                style={{ ...styles.input, ...(isDark ? styles.inputDark : {}) }}
                placeholder={isLogin ? 'you@example.com or admin' : 'you@example.com'}
                required
                autoComplete={isLogin ? 'username' : 'email'}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={{ ...styles.label, ...(isDark ? styles.labelDark : {}) }}>Password</label>
            <div style={styles.inputContainer}>
              <FaLock style={{ ...styles.inputIcon, ...(isDark ? styles.inputIconDark : {}) }} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="auth-input-field auth-input-field--password"
                style={{ ...styles.input, ...(isDark ? styles.inputDark : {}) }}
                placeholder="••••••••"
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {!isLogin && (
              <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', margin: '6px 0 0 0' }}>
                Min 8 chars, uppercase, lowercase, number, special (!@#$%^&*)
              </p>
            )}
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
              cursor: 'pointer',
              fontSize: '14px',
              color: isDark ? '#e2e8f0' : '#4a5568',
              fontWeight: 500
            }}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#667eea' }}
            />
            Keep me signed in for 90 days
          </label>
          {!rememberMe && (
            <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', margin: '-8px 0 16px 28px' }}>
              Session ends after 7 days — you’ll need email & password again.
            </p>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
            style={{
              ...styles.submitButton,
              ...(isDark ? styles.submitButtonDark : {})
            }}
          >
            {loading ? (
              <div style={styles.spinner}></div>
            ) : isLogin ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={{ ...styles.footerText, ...(isDark ? styles.footerTextDark : {}) }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              className="auth-switch-mode-btn"
              onClick={() => setIsLogin(!isLogin)}
              style={{
                ...styles.footerButton,
                ...(isDark ? styles.footerButtonDark : {})
              }}
            >
              {isLogin ? 'Sign up now' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
    }
    localStorage.setItem('theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#020617' : '#f8fafc');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const isAuthenticated = () => {
    return !!localStorage.getItem('token');
  };

  const isAdmin = () => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return u.role === 'admin';
    } catch {
      return false;
    }
  };

  /** Sync role from API (e.g. after ADMIN_EMAIL promotion) so /admin nav appears without re-login. */
  const [, setProfileSync] = useState(0);
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    profileAPI
      .getProfile()
      .then((data) => {
        try {
          const u = JSON.parse(localStorage.getItem('user') || '{}');
          const { success: _s, ...rest } = data;
          const next = {
            ...u,
            ...rest,
            id: u.id,
          };
          localStorage.setItem('user', JSON.stringify(next));
          setProfileSync((n) => n + 1);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, []);

  return (
    <AppRouter>
      {theme === 'light' && (
        <div className="light-iridescence-backdrop" aria-hidden>
          <Iridescence
            backdrop
            color={[0.44, 0.54, 0.66]}
            mouseReact
            amplitude={0.1}
            speed={0.75}
          />
        </div>
      )}
      {theme === 'dark' && (
        <div className="dark-veil-backdrop" aria-hidden>
          <div className="dark-veil-backdrop-inner">
            <DarkVeil
              hueShift={0}
              noiseIntensity={0}
              scanlineIntensity={0}
              speed={0}
              scanlineFrequency={0}
              warpAmount={0}
            />
          </div>
        </div>
      )}
      <div
        className={
          theme === 'light'
            ? 'app-root-layer app-root-layer--aurora'
            : 'app-root-layer app-root-layer--dark-aurora'
        }
      >
        <ChatNotificationListener />
        <SessionSocketBridge />
        <Routes>
        <Route 
          path="/login" 
          element={
            !isAuthenticated() ? (
              <AuthPage
                isLogin={isLogin}
                setIsLogin={setIsLogin}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            ) : (
              <Navigate to="/dashboard" />
            )
          } 
        />
        <Route 
          path="/register" 
          element={
            !isAuthenticated() ? (
              <AuthPage
                isLogin={false}
                setIsLogin={setIsLogin}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            ) : (
              <Navigate to="/dashboard" />
            )
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            isAuthenticated() ? (
              <Dashboard theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        <Route 
          path="/community" 
          element={
            isAuthenticated() ? (
              <PublicWorkouts theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        <Route 
          path="/progress" 
          element={
            isAuthenticated() ? (
              <Progress theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        <Route 
          path="/challenges" 
          element={
            isAuthenticated() ? (
              <Challenges theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        <Route 
          path="/profile/:userId" 
          element={
            isAuthenticated() ? (
              <UserProfile theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        <Route 
          path="/profile" 
          element={
            isAuthenticated() ? (
              <Profile theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        <Route
          path="/calories"
          element={
            isAuthenticated() ? <Navigate to="/tracking?tab=calories" replace /> : <Navigate to="/login" />
          }
        />
        <Route 
          path="/tracking" 
          element={
            isAuthenticated() ? (
              <Tracking theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        <Route
          path="/admin"
          element={
            isAuthenticated() && isAdmin() ? (
              <Admin theme={theme} onToggleTheme={toggleTheme} />
            ) : (
              <Navigate to={isAuthenticated() ? '/dashboard' : '/login'} replace />
            )
          }
        />
        <Route 
          path="/" 
          element={
            <Navigate to={isAuthenticated() ? "/dashboard" : "/login"} />
          } 
        />
        </Routes>
      </div>
    </AppRouter>
  );
}

// Auth Styles
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  },
  containerDarkAurora: {
    background: 'transparent',
  },
  containerLightAurora: {
    background: 'transparent',
  },
  card: {
    background: '#fff',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    padding: '40px',
    width: '100%',
    maxWidth: '450px',
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  cardDark: {
    background: 'rgba(15, 23, 42, 0.9)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
    border: '1px solid rgba(148, 163, 184, 0.35)',
  },
  subtitle: {
    fontSize: '16px',
    color: '#718096',
    margin: '0',
  },
  form: {
    marginBottom: '24px',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: '8px',
  },
  labelDark: {
    color: '#e2e8f0',
  },
  inputContainer: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#a0aec0',
    fontSize: '18px',
  },
  inputIconDark: {
    color: '#94a3b8',
  },
  input: {
    width: '100%',
    padding: '16px 16px 16px 50px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '16px',
    color: '#2d3748',
    background: '#ffffff',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
  },
  inputDark: {
    background: 'rgba(30, 41, 59, 0.9)',
    borderColor: 'rgba(148, 163, 184, 0.4)',
    color: '#f1f5f9',
  },
  themeToggle: {
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid rgba(148, 163, 184, 0.5)',
    background: 'rgba(255, 255, 255, 0.85)',
    color: '#1e293b',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  themeToggleDark: {
    background: 'rgba(15, 23, 42, 0.9)',
    color: '#e5e7eb',
    borderColor: 'rgba(148, 163, 184, 0.8)',
  },
  submitButton: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDark: {
    background: 'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)',
    boxShadow: '0 18px 45px rgba(16, 185, 129, 0.55)',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTop: '3px solid #fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorAlert: {
    background: '#fed7d7',
    border: '1px solid #fc8181',
    color: '#c53030',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  successAlert: {
    background: '#c6f6d5',
    border: '1px solid #9ae6b4',
    color: '#22543d',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  footer: {
    textAlign: 'center',
    paddingTop: '20px',
    borderTop: '1px solid #e2e8f0',
  },
  footerText: {
    margin: '0',
    fontSize: '14px',
    color: '#718096',
  },
  footerTextDark: {
    color: '#cbd5f5',
  },
  footerButton: {
    background: 'none',
    border: 'none',
    color: '#667eea',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '0',
    fontSize: '14px',
  },
  footerButtonDark: {
    color: '#a5b4fc',
  },
};

export default App;