import { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';

const activityLevels = [
  { value: '1.2', label: 'Sedentary', desc: 'Little or no exercise' },
  { value: '1.375', label: 'Light', desc: '1–3 days/week' },
  { value: '1.55', label: 'Moderate', desc: '3–5 days/week' },
  { value: '1.725', label: 'Active', desc: '6–7 days/week' },
  { value: '1.9', label: 'Very Active', desc: 'Hard exercise daily' },
];

const goals = [
  { value: 'cut', label: 'Lose Weight', adj: -500, color: '#f093fb' },
  { value: 'maintain', label: 'Maintain', adj: 0, color: '#667eea' },
  { value: 'bulk', label: 'Gain Muscle', adj: 300, color: '#43e97b' },
];

/**
 * Calorie calculator form + results (used on Tracking → Calories tab).
 */
export function CaloriesCalculatorPanel() {
  const [form, setForm] = useState({
    age: '',
    gender: 'male',
    weight: '',
    height: '',
    unit: 'metric',
    activity: '1.55',
    goal: 'maintain',
  });
  const [result, setResult] = useState(null);
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);
  const activityDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activityDropdownRef.current && !activityDropdownRef.current.contains(e.target)) {
        setActivityDropdownOpen(false);
      }
    };
    if (activityDropdownOpen) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activityDropdownOpen]);

  const calculate = () => {
    const { age, gender, weight, height, unit, activity, goal } = form;
    if (!age || !weight || !height) return;

    let weightKg = parseFloat(weight);
    let heightCm = parseFloat(height);
    const ageNum = parseInt(age, 10);
    if (Number.isNaN(ageNum) || ageNum < 1 || ageNum > 120) return;
    if (Number.isNaN(weightKg) || weightKg < 1) return;
    if (Number.isNaN(heightCm) || heightCm < 1) return;

    if (unit === 'imperial') {
      weightKg = weightKg * 0.453592;
      heightCm = heightCm * 2.54;
    }

    const bmr =
      gender === 'male'
        ? 10 * weightKg + 6.25 * heightCm - 5 * parseFloat(age) + 5
        : 10 * weightKg + 6.25 * heightCm - 5 * parseFloat(age) - 161;

    const tdee = Math.round(bmr * parseFloat(activity));
    const goalAdj = goals.find((g) => g.value === goal).adj;
    const target = tdee + goalAdj;
    const protein = Math.round(weightKg * 2.0);
    const fat = Math.round((target * 0.25) / 9);
    const carbs = Math.round((target - protein * 4 - fat * 9) / 4);

    setResult({ tdee, target, protein, fat, carbs, bmr: Math.round(bmr) });
  };

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const clampAge = (v) => {
    if (v === '' || v === '-') return v;
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return v;
    return String(Math.max(1, Math.min(120, n)));
  };
  const clampPositive = (v, min = 1) => {
    if (v === '' || v === '-') return v;
    const n = parseFloat(v);
    if (Number.isNaN(n)) return v;
    return String(Math.max(min, n));
  };
  const currentGoal = goals.find((g) => g.value === form.goal);
  const currentActivity = activityLevels.find((a) => a.value === form.activity);

  return (
    <div className="calories-panel track-panel">
      <div className="calories-section">
        <label className="calories-label">Unit</label>
        <div className="toggle-group">
          {['metric', 'imperial'].map((u) => (
            <button
              key={u}
              type="button"
              className={`toggle-btn ${form.unit === u ? 'active' : ''}`}
              onClick={() => update('unit', u)}
            >
              {u === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lb/in)'}
            </button>
          ))}
        </div>
      </div>

      <div className="calories-section">
        <label className="calories-label">Gender</label>
        <div className="toggle-group">
          {['male', 'female'].map((g) => (
            <button
              key={g}
              type="button"
              className={`toggle-btn ${form.gender === g ? 'active' : ''}`}
              onClick={() => update('gender', g)}
            >
              {g === 'male' ? '♂ Male' : '♀ Female'}
            </button>
          ))}
        </div>
      </div>

      <div className="calories-row">
        <div className="form-group">
          <label className="calories-label">Age</label>
          <input
            className="calories-input"
            type="number"
            min={1}
            max={120}
            placeholder="25"
            value={form.age}
            onChange={(e) => update('age', clampAge(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label className="calories-label">
            Weight ({form.unit === 'metric' ? 'kg' : 'lbs'})
          </label>
          <input
            className="calories-input"
            type="number"
            min={1}
            placeholder={form.unit === 'metric' ? '75' : '165'}
            value={form.weight}
            onChange={(e) => update('weight', clampPositive(e.target.value))}
          />
        </div>
      </div>

      <div className="calories-section">
        <label className="calories-label">
          Height ({form.unit === 'metric' ? 'cm' : 'inches'})
        </label>
        <input
          className="calories-input"
          type="number"
          min={1}
          placeholder={form.unit === 'metric' ? '175' : '69'}
          value={form.height}
          onChange={(e) => update('height', clampPositive(e.target.value))}
        />
      </div>

      <div className="calories-section" ref={activityDropdownRef}>
        <label className="calories-label">Activity Level</label>
        <div className="exercise-dropdown" style={{ width: '100%', minWidth: 0 }}>
          <button
            type="button"
            className={`exercise-dropdown-trigger ${activityDropdownOpen ? 'open' : ''}`}
            onClick={() => setActivityDropdownOpen((p) => !p)}
            aria-haspopup="listbox"
            aria-expanded={activityDropdownOpen}
          >
            <span className={`exercise-dropdown-label ${!currentActivity ? 'placeholder' : ''}`}>
              {currentActivity ? `${currentActivity.label} — ${currentActivity.desc}` : 'Select activity level'}
            </span>
            <FiChevronDown className={`exercise-dropdown-chevron ${activityDropdownOpen ? 'open' : ''}`} />
          </button>
          {activityDropdownOpen && (
            <ul className="exercise-dropdown-list" role="listbox">
              {activityLevels.map((a) => (
                <li
                  key={a.value}
                  role="option"
                  aria-selected={form.activity === a.value}
                  className={`exercise-dropdown-option ${form.activity === a.value ? 'selected' : ''}`}
                  onClick={() => {
                    update('activity', a.value);
                    setActivityDropdownOpen(false);
                  }}
                >
                  {a.label} — {a.desc}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="calories-section">
        <label className="calories-label">Goal</label>
        <div className="calories-goal-grid">
          {goals.map((g) => (
            <button
              key={g.value}
              type="button"
              className={`calories-goal-btn ${form.goal === g.value ? 'active' : ''}`}
              style={{ '--goal-color': g.color }}
              onClick={() => update('goal', g.value)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="calories-calc-btn submit-btn" onClick={calculate}>
        Calculate My Calories →
      </button>

      {result && (
        <div className="calories-result-box">
          <div className="calories-big-cal">
            <span
              className="calories-cal-num"
              style={{
                background: `linear-gradient(135deg, ${currentGoal?.color || '#667eea'}, #764ba2)`,
              }}
            >
              {result.target.toLocaleString()}
            </span>
            <span className="calories-cal-label">calories / day</span>
          </div>

          <div className="calories-macro-row">
            <div className="calories-macro-card" style={{ '--macro-color': '#f6a623' }}>
              <span className="calories-macro-val">{result.protein}g</span>
              <span className="calories-macro-name">Protein</span>
            </div>
            <div className="calories-macro-card" style={{ '--macro-color': '#4ecdc4' }}>
              <span className="calories-macro-val">{result.carbs}g</span>
              <span className="calories-macro-name">Carbs</span>
            </div>
            <div className="calories-macro-card" style={{ '--macro-color': '#f093fb' }}>
              <span className="calories-macro-val">{result.fat}g</span>
              <span className="calories-macro-name">Fat</span>
            </div>
          </div>

          <div className="calories-divider" />

          <div className="calories-info-row">
            <span className="calories-info-label">Base Metabolic Rate</span>
            <span className="calories-info-val">{result.bmr.toLocaleString()} kcal</span>
          </div>
          <div className="calories-info-row">
            <span className="calories-info-label">Maintenance (TDEE)</span>
            <span className="calories-info-val">{result.tdee.toLocaleString()} kcal</span>
          </div>
          <div className="calories-info-row">
            <span className="calories-info-label">Goal Adjustment</span>
            <span className="calories-info-val">
              {currentGoal.adj > 0 ? '+' : ''}
              {currentGoal.adj} kcal
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
