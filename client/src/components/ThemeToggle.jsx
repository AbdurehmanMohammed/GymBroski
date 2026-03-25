import React from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';

const ThemeToggle = ({ theme, onToggleTheme, variant = 'sidebar' }) => {
  if (!onToggleTheme) return null;

  const isDark = theme === 'dark';

  return (
    <div className={`theme-toggle theme-toggle-slider ${variant}`} role="switch" aria-checked={isDark}>
      <button
        type="button"
        className="theme-toggle-track"
        onClick={onToggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <div className={`theme-toggle-thumb ${isDark ? 'night' : 'day'}`} />
        <span className={`theme-toggle-icon theme-toggle-icon-sun ${isDark ? 'on-dark' : 'on-thumb'}`}>
          <FiSun size={18} />
        </span>
        <span className={`theme-toggle-icon theme-toggle-icon-moon ${isDark ? 'on-thumb' : 'on-dark'}`}>
          <FiMoon size={18} />
        </span>
      </button>
      <div className="theme-toggle-labels">
        <span>DAY</span>
        <span>NIGHT</span>
      </div>
    </div>
  );
};

export default ThemeToggle;
