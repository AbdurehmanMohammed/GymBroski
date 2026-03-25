import React, { useState, useEffect, useRef } from 'react';
import { FiCheck, FiX, FiPlay, FiAward } from 'react-icons/fi';
import { workoutSessionsAPI, trackingAPI } from '../services/api';
import { resolveExerciseVideoUrl, getExerciseDemoVideoUrl } from '../utils/exerciseDemoVideo';
import { ExerciseVideoInfoIcon, ExerciseVideoHelpModal } from './ExerciseVideoHelp';
import Iridescence from './Iridescence';
import DarkVeil from './DarkVeil';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatDuration = (seconds) => {
  if (seconds < 60) return `${seconds}sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}min ${s}sec` : `${m}min`;
};

/** Display weight/reps from history row */
const formatKgRepsFromHistory = (weight, reps) => {
  const w = weight != null && weight !== '' ? Number(weight) : 0;
  const r = reps != null && reps !== '' ? String(reps).trim() : '';
  if (!w && !r) return '—';
  if (w > 0) return `${w} kg × ${r || '—'}`;
  return r ? `${r} reps` : '—';
};

const ActiveWorkoutSession = ({ workout, onClose, onFinish, theme = 'light' }) => {
  const [sessionStart] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [restDurationSec, setRestDurationSec] = useState(120); // user-selected rest (min*60 + sec)
  const restMin = Math.floor(restDurationSec / 60);
  const restSec = restDurationSec % 60;

  // Live workout duration timer - updates every second
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStart]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [exerciseState, setExerciseState] = useState(() =>
    (workout.exercises || []).map((ex) => ({
      id: ex.name + ex.muscleGroup,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      sets: Array.from({ length: ex.sets || 3 }, (_, i) => ({
        setNum: i + 1,
        weight: '',
        reps: '',
        completed: false,
        restSecondsLeft: null,
      })),
    }))
  );
  const [activeRest, setActiveRest] = useState(null); // { exIdx, setIdx }
  const [userPRs, setUserPRs] = useState({}); // { exerciseNameLower: { weight, reps } }
  /** Last *completed* workout for this template: exercise name (lower) → { sets[], bestSet } */
  const [lastSessionByExercise, setLastSessionByExercise] = useState({});
  const [validationMessage, setValidationMessage] = useState(null);
  const [exerciseVideoHelp, setExerciseVideoHelp] = useState(null); // { name, url }
  const [finishing, setFinishing] = useState(false);
  /** Only show "Saving…" after a short delay so fast saves feel instant (no flash). */
  const [showSavingLabel, setShowSavingLabel] = useState(false);
  const savingLabelTimerRef = useRef(null);
  const restIntervalRef = useRef(null);

  useEffect(() => {
    if (!validationMessage) return;
    const t = setTimeout(() => setValidationMessage(null), 8000);
    return () => clearTimeout(t);
  }, [validationMessage]);

  useEffect(() => {
    trackingAPI.getPR().then((prs) => {
      const map = {};
      prs.forEach((p) => {
        const key = (p.exerciseName || '').trim().toLowerCase();
        if (!key) return;
        const w = p.weight || 0;
        const r = p.reps || 1;
        if (!map[key] || w > map[key].weight || (w === map[key].weight && r > map[key].reps)) {
          map[key] = { weight: w, reps: r };
        }
      });
      setUserPRs(map);
    }).catch(() => {});
  }, []);

  /** Load most recent finished session for this workout to show per-set "Last session" column */
  useEffect(() => {
    let cancelled = false;
    const wid = workout?._id ? String(workout._id) : null;
    const wname = (workout?.name || '').trim();

    workoutSessionsAPI
      .getAll()
      .then((sessions) => {
        if (cancelled || !Array.isArray(sessions)) return;
        let match = null;
        if (wid) {
          match = sessions.find((s) => s.workoutId != null && String(s.workoutId) === wid);
        }
        if (!match && wname) {
          match = sessions.find((s) => s.workoutName && String(s.workoutName).trim() === wname);
        }
        if (!match?.exerciseBreakdown?.length) {
          setLastSessionByExercise({});
          return;
        }
        const byEx = {};
        match.exerciseBreakdown.forEach((row) => {
          const key = (row.name || '').trim().toLowerCase();
          if (!key) return;
          byEx[key] = {
            sets: Array.isArray(row.sets) ? row.sets : [],
            bestSet: row.bestSet || '',
          };
        });
        setLastSessionByExercise(byEx);
      })
      .catch(() => {
        if (!cancelled) setLastSessionByExercise({});
      });
    return () => {
      cancelled = true;
    };
  }, [workout?._id, workout?.name]);

  const getExercisePR = (exerciseName) => {
    const key = (exerciseName || '').trim().toLowerCase();
    return userPRs[key];
  };

  useEffect(() => {
    if (!activeRest) return;
    const { exIdx, setIdx } = activeRest;
    restIntervalRef.current = setInterval(() => {
      setExerciseState((prev) => {
        const next = [...prev];
        const ex = { ...next[exIdx], sets: [...next[exIdx].sets] };
        const s = { ...ex.sets[setIdx] };
        if (s.restSecondsLeft <= 1) {
          clearInterval(restIntervalRef.current);
          setActiveRest(null);
          s.restSecondsLeft = null;
        } else {
          s.restSecondsLeft = s.restSecondsLeft - 1;
        }
        ex.sets[setIdx] = s;
        next[exIdx] = ex;
        return next;
      });
    }, 1000);
    return () => clearInterval(restIntervalRef.current);
  }, [activeRest]);

  const playCompleteSound = () => {
    try {
      const audio = new Audio('/aplausos_2.mp3');
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch (_) {}
  };

  const playPRSound = () => {
    try {
      const audio = new Audio('/set-complete.mp3');
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch (_) {}
  };

  const playBailSound = () => {
    try {
      const audio = new Audio('/why-are-you-running.mp3');
      audio.volume = 0.8;
      audio.play().catch(() => {});
    } catch (_) {}
  };

  const handleToggleSet = (exIdx, setIdx) => {
    setExerciseState((prev) => {
      const s = prev[exIdx].sets[setIdx];
      const wasCompleted = s.completed;

      const next = [...prev];
      const ex = { ...next[exIdx], sets: [...next[exIdx].sets] };
      const s2 = { ...ex.sets[setIdx] };

      if (wasCompleted) {
        s2.completed = false;
        delete s2.completedAt;
        s2.restSecondsLeft = 0;
      } else {
        const now = Date.now();
        s2.completed = true;
        s2.completedAt = s2.completedAt ?? now;
        s2.restSecondsLeft = restDurationSec;
      }
      ex.sets[setIdx] = s2;
      next[exIdx] = ex;

      queueMicrotask(() => {
        if (wasCompleted) {
          setActiveRest((ar) => (ar?.exIdx === exIdx && ar?.setIdx === setIdx ? null : ar));
          if (restIntervalRef.current) {
            clearInterval(restIntervalRef.current);
            restIntervalRef.current = null;
          }
        } else {
          setActiveRest({ exIdx, setIdx });
        }
      });

      return next;
    });
  };

  const handleAddSet = (exIdx) => {
    setExerciseState((prev) => {
      const next = [...prev];
      const ex = { ...next[exIdx], sets: [...next[exIdx].sets] };
      const num = ex.sets.length + 1;
      ex.sets.push({
        setNum: num,
        weight: ex.sets[ex.sets.length - 1]?.weight ?? '',
        reps: ex.sets[ex.sets.length - 1]?.reps ?? '',
        completed: false,
        restSecondsLeft: null,
      });
      next[exIdx] = ex;
      return next;
    });
  };

  const updateSet = (exIdx, setIdx, field, value) => {
    setExerciseState((prev) => {
      const next = [...prev];
      const ex = { ...next[exIdx], sets: [...next[exIdx].sets] };
      ex.sets[setIdx] = { ...ex.sets[setIdx], [field]: value };
      next[exIdx] = ex;
      return next;
    });
  };

  const buildSummary = () => {
    const durationSec = Math.floor((Date.now() - sessionStart) / 1000);
    let totalVolume = 0;
    const exerciseBreakdown = exerciseState.map((ex) => {
      const completedSets = ex.sets.filter((s) => s.completed);
      let bestSet = null;
      let bestVolume = -1;
      let durationSec = 0;
      const withTime = completedSets.filter((s) => s.completedAt);
      if (withTime.length >= 2) {
        const first = Math.min(...withTime.map((s) => s.completedAt));
        const last = Math.max(...withTime.map((s) => s.completedAt));
        durationSec = Math.floor((last - first) / 1000);
      } else if (withTime.length === 1) {
        durationSec = 0; // single set = no meaningful duration
      }
      completedSets.forEach((s) => {
        const w = Math.max(0, parseFloat(s.weight) || 0);
        const r = Math.max(0, parseInt(s.reps, 10) || 0);
        const vol = w * r;
        totalVolume += vol;
        if (vol >= bestVolume) {
          bestVolume = vol;
          bestSet = { weight: w, reps: s.reps, repsNum: r };
        }
      });
      let bestSetLabel = '—';
      if (bestSet) {
        if (bestSet.weight > 0) bestSetLabel = `${bestSet.weight} kg × ${bestSet.reps || '—'}`;
        else bestSetLabel = `${bestSet.reps || '0'} reps`;
      }
      const setsLogged = completedSets.map((s) => ({
        weight: Math.max(0, parseFloat(s.weight) || 0),
        reps: (s.reps || '').toString(),
      }));
      return {
        name: ex.name,
        setsCount: completedSets.length,
        bestSet: bestSetLabel,
        bestSetWeight: bestSet?.weight ?? 0,
        bestSetReps: bestSet?.repsNum ?? 0,
        durationSec,
        sets: setsLogged,
      };
    });
    return {
      workoutName: workout.name,
      dateStr: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
      durationSec,
      totalVolume: Math.round(totalVolume),
      exerciseBreakdown,
      workoutCount: 0,
    };
  };

  /** Compare workout breakdown to PRs already in state (no extra fetch). */
  const computeNewPRs = (exerciseBreakdown, prsMap) => {
    const newPRs = [];
    const merged = { ...prsMap };
    for (const ex of exerciseBreakdown) {
      if (ex.setsCount === 0) continue;
      const weight = ex.bestSetWeight ?? 0;
      const reps = ex.bestSetReps ?? 0;
      if (weight === 0 && reps === 0) continue;
      const key = ex.name?.trim().toLowerCase();
      if (!key) continue;
      const prev = merged[key];
      const isNewPR = !prev || weight > prev.weight || (weight === prev.weight && reps > prev.reps);
      if (!isNewPR) continue;
      const name = ex.name.trim();
      const r = reps || 1;
      newPRs.push({
        exerciseName: name,
        weight,
        reps: r,
        bestSet: ex.bestSet,
      });
      merged[key] = { weight, reps: r };
    }
    return newPRs;
  };

  const handleFinish = async () => {
    const incomplete = exerciseState.filter((ex) => ex.sets.every((s) => !s.completed));
    if (incomplete.length > 0) {
      playBailSound();
      const names = incomplete.map((e) => e.name).join(', ');
      const msg = incomplete.length === 1
        ? `Nice try! 😅 You gotta hit ${names} at least once—no skipping leg day (or arm day, or any day)!`
        : `Whoa there! 🏋️ You left ${names} hanging. Give them some love before you peace out!`;
      setValidationMessage(msg);
      return;
    }

    setFinishing(true);
    setShowSavingLabel(false);
    savingLabelTimerRef.current = setTimeout(() => setShowSavingLabel(true), 400);

    try {
      const data = buildSummary();
      const newPRs = computeNewPRs(data.exerciseBreakdown, userPRs);
      const dateISO = new Date().toISOString().slice(0, 10);
      const sessionPayload = {
        workoutName: data.workoutName,
        workoutId: workout._id || null,
        dateStr: data.dateStr,
        dateISO,
        durationSec: data.durationSec,
        totalVolume: data.totalVolume,
        exerciseBreakdown: data.exerciseBreakdown || [],
        prs: newPRs || [],
      };

      /** Session save + PR posts in parallel — same wall time as the slowest call, not sum of all */
      const tasks = [
        workoutSessionsAPI.create(sessionPayload),
        ...newPRs.map((p) =>
          trackingAPI.addPR({
            exerciseName: p.exerciseName,
            weight: p.weight,
            reps: p.reps,
          })
        ),
      ];
      const results = await Promise.allSettled(tasks);
      const sessionRes = results[0];
      let workoutCount = 1;
      if (sessionRes.status === 'fulfilled') {
        workoutCount = sessionRes.value?.workoutCount ?? 1;
      } else {
        console.error('Failed to save workout history:', sessionRes.reason);
      }
      setSummaryData({
        ...data,
        prs: newPRs,
        workoutCount,
      });
      if (newPRs.length > 0) {
        setUserPRs((prev) => {
          const next = { ...prev };
          newPRs.forEach((p) => {
            const k = p.exerciseName.trim().toLowerCase();
            next[k] = { weight: p.weight, reps: p.reps };
          });
          return next;
        });
      }
      setShowSummary(true);
      playCompleteSound();
      if ((newPRs?.length ?? 0) > 0) playPRSound();
    } finally {
      if (savingLabelTimerRef.current) {
        clearTimeout(savingLabelTimerRef.current);
        savingLabelTimerRef.current = null;
      }
      setShowSavingLabel(false);
      setFinishing(false);
    }
  };

  const handleCloseSummary = async () => {
    // Points awarded server-side when session is saved
    onFinish?.();
    onClose();
  };

  const dateStr = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (showSummary && summaryData) {
    const nth = (n) => {
      const v = n % 100;
      if (v >= 11 && v <= 13) return `${n}th`;
      switch (n % 10) {
        case 1: return `${n}st`;
        case 2: return `${n}nd`;
        case 3: return `${n}rd`;
        default: return `${n}th`;
      }
    };
    return (
      <>
      <div className="modal-overlay history-detail-overlay" onClick={handleCloseSummary}>
        <div
          className="workout-history-detail-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="summary-close-btn" onClick={handleCloseSummary} aria-label="Close">
            <FiX size={24} />
          </button>
          <div className="summary-congrats">
            <div className="summary-stars">★★★</div>
            <h2 className="summary-title">Congratulations!</h2>
            <p className="summary-count">
              You completed your {nth(summaryData.workoutCount)} workout!
            </p>
          </div>
          <div className="summary-card">
            <h3 className="summary-card-title">{summaryData.workoutName}</h3>
            <p className="summary-card-date">{summaryData.dateStr}</p>
            <div className="summary-stats">
              <span className="summary-stat summary-stat--labeled">
                <span className="summary-stat-label">Session time</span>
                <span className="summary-stat-row">
                  <span className="summary-stat-icon">⏱</span>
                  {formatDuration(summaryData.durationSec)}
                </span>
              </span>
              <span className="summary-stat summary-stat--labeled">
                <span className="summary-stat-label">Volume</span>
                <span className="summary-stat-row">
                  <span className="summary-stat-icon">🏋</span>
                  {summaryData.totalVolume.toLocaleString()} kg
                </span>
              </span>
              <span
                className="summary-stat summary-stat--labeled"
                title="Personal records earned this workout. Beat your previous best to earn PRs!"
              >
                <span className="summary-stat-label">PRs</span>
                <span className="summary-stat-row">
                  <FiAward size={18} className="summary-stat-icon" />
                  {(summaryData.prs?.length ?? 0) > 0
                    ? `${summaryData.prs.length} new PR${summaryData.prs.length > 1 ? 's' : ''}!`
                    : 'No PRs this workout'}
                </span>
              </span>
            </div>
            {(summaryData.prs?.length ?? 0) === 0 && (
              <p className="summary-pr-hint">Beat your previous best weight/reps to earn PRs.</p>
            )}
            <div className="summary-exercises">
              <div className="summary-ex-row header">
                <span>Exercise</span>
                <span>Best Set</span>
                <span>Duration</span>
              </div>
              {summaryData.exerciseBreakdown
                .filter((row) => row.setsCount > 0)
                .map((row, i) => {
                  const isPR = (summaryData.prs || []).some((p) =>
                    p.exerciseName?.toLowerCase() === row.name?.toLowerCase()
                  );
                  return (
                    <div key={i} className="summary-ex-row">
                      <span className="summary-exercise-cell">
                        <span className="summary-exercise-text">
                          {row.setsCount} × {row.name}
                          {isPR && <span className="summary-pr-badge" title="Personal Record"> 🏆</span>}
                        </span>
                        <ExerciseVideoInfoIcon
                          size={14}
                          onClick={() =>
                            setExerciseVideoHelp({
                              name: row.name,
                              url: getExerciseDemoVideoUrl(row.name),
                            })
                          }
                        />
                      </span>
                      <span>{row.bestSet}</span>
                      <span className="summary-ex-duration">
                        {row.durationSec > 0 ? formatDuration(row.durationSec) : '—'}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
          <div className="workout-history-modal-actions">
            <button type="button" className="summary-done-btn" onClick={handleCloseSummary}>
              Done
            </button>
          </div>
        </div>
      </div>
      <ExerciseVideoHelpModal
        open={!!exerciseVideoHelp}
        exerciseName={exerciseVideoHelp?.name}
        videoUrl={exerciseVideoHelp?.url}
        onClose={() => setExerciseVideoHelp(null)}
      />
      </>
    );
  }

  const isLight = theme === 'light';

  return (
    <div
      className={`active-session-overlay${
        isLight ? ' active-session-overlay--aurora' : ' active-session-overlay--dark-aurora'
      }`}
    >
      <div className="active-session-iridescence" aria-hidden>
        {isLight ? (
          <Iridescence
            backdrop
            color={[0.78, 0.74, 0.95]}
            mouseReact
            amplitude={0.1}
            speed={0.75}
          />
        ) : (
          <DarkVeil
            hueShift={0}
            noiseIntensity={0}
            scanlineIntensity={0}
            speed={0}
            scanlineFrequency={0}
            warpAmount={0}
          />
        )}
      </div>
      {/* Validation message banner */}
      {validationMessage && (
        <div className="session-validation-banner">
          <p>{validationMessage}</p>
          <button
            type="button"
            className="session-validation-close"
            onClick={() => setValidationMessage(null)}
            aria-label="Dismiss"
          >
            <FiX size={20} />
          </button>
        </div>
      )}
      {/* Duration bar at top - always visible */}
      <div className="session-duration-bar">
        <span className="session-duration-label">Duration</span>
        <span className="session-duration-time session-duration-accent">{formatTime(elapsedSec)}</span>
      </div>
      <div className="active-session">
        <div className="session-content">
          <div className="session-header">
            <div>
              <h1 className="session-title">{workout.name}</h1>
              <div className="session-meta">
                <span className="session-date">📅 {dateStr}</span>
              </div>
            </div>
            <div className="session-header-actions">
              <div className="session-rest-settings">
                <span>Rest between sets</span>
                <div className="session-rest-input-wrap session-rest-mmss">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={restMin}
                    onChange={(e) => {
                      const m = parseInt(e.target.value, 10) || 0;
                      setRestDurationSec(Math.min(Math.max(m * 60 + restSec, 15), 1200));
                    }}
                    className="session-rest-input session-rest-min"
                  />
                  <span className="session-rest-colon">:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={restSec}
                    onChange={(e) => {
                      const s = parseInt(e.target.value, 10) || 0;
                      setRestDurationSec(Math.min(Math.max(restMin * 60 + Math.min(s, 59), 15), 1200));
                    }}
                    className="session-rest-input session-rest-sec"
                  />
                </div>
              </div>
            </div>
          </div>

          {exerciseState.map((ex, exIdx) => {
            const pr = getExercisePR(ex.name);
            return (
            <div key={ex.id} className="session-exercise">
              <div className="session-exercise-header">
                <span className="session-exercise-label">Exercise</span>
                <div className="session-exercise-title-row">
                  <h3 className="session-exercise-name">{ex.name}</h3>
                  <ExerciseVideoInfoIcon
                    size={18}
                    onClick={() =>
                      setExerciseVideoHelp({
                        name: ex.name,
                        url: resolveExerciseVideoUrl(workout.exercises?.[exIdx]),
                      })
                    }
                  />
                </div>
                {pr && (
                  <span className="session-exercise-pr">
                    <FiAward size={14} /> Your PR: {pr.weight > 0 ? `${pr.weight} kg × ${pr.reps}` : `${pr.reps} reps`}
                  </span>
                )}
              </div>
              <div className="session-sets-table">
                <div className="session-sets-header">
                  <span>Set</span>
                  <span title="What you logged last time you finished this workout">Last session</span>
                  <span>kg</span>
                  <span>Reps</span>
                  <span></span>
                </div>
                {ex.sets.map((s, setIdx) => {
                  const key = (ex.name || '').trim().toLowerCase();
                  const hist = lastSessionByExercise[key];
                  let lastSessionCell = '—';
                  if (hist?.sets?.length > setIdx) {
                    const row = hist.sets[setIdx];
                    lastSessionCell = formatKgRepsFromHistory(row?.weight, row?.reps);
                  } else if (setIdx === 0 && hist?.bestSet) {
                    lastSessionCell = hist.bestSet;
                  }
                  return (
                  <React.Fragment key={setIdx}>
                    <div className="session-set-row">
                      <span className="set-num">{s.setNum}</span>
                      <span
                        className="set-prev"
                        title="From your last saved workout with this routine (per set when available)"
                      >
                        {lastSessionCell}
                      </span>
                      <input
                        type="number"
                        className="set-input"
                        min={0}
                        step="0.5"
                        value={s.weight}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || v === '-') {
                            updateSet(exIdx, setIdx, 'weight', v);
                            return;
                          }
                          const n = parseFloat(v);
                          if (!Number.isNaN(n) && n < 0) return;
                          updateSet(exIdx, setIdx, 'weight', v);
                        }}
                        placeholder="0"
                      />
                      <input
                        type="text"
                        className="set-input"
                        value={s.reps}
                        onChange={(e) => {
                          const v = e.target.value;
                          const n = parseInt(v, 10);
                          if (v !== '' && !Number.isNaN(n) && n < 0) return;
                          updateSet(exIdx, setIdx, 'reps', v);
                        }}
                        title="Typical rep range hint — enter what you actually did this set"
                        placeholder="10-12"
                      />
                      <button
                        type="button"
                        className={`set-complete-btn ${s.completed ? 'done' : ''}`}
                        onClick={() => handleToggleSet(exIdx, setIdx)}
                        title={s.completed ? 'Undo — tap to uncheck' : 'Mark done'}
                        aria-pressed={s.completed}
                      >
                        <FiCheck size={18} />
                      </button>
                    </div>
                    {/* Rest timer bar between sets */}
                    <div
                      className={`session-rest-bar ${
                        s.restSecondsLeft !== null && s.restSecondsLeft > 0 ? 'active' : 'inactive'
                      }`}
                    >
                      {s.restSecondsLeft !== null && s.restSecondsLeft > 0
                        ? formatTime(s.restSecondsLeft)
                        : s.restSecondsLeft === 0
                          ? '0:00'
                          : `${Math.floor(restDurationSec / 60)}:${String(
                              restDurationSec % 60
                            ).padStart(2, '0')}`}
                    </div>
                  </React.Fragment>
                  );
                })}
                <button
                  type="button"
                  className="session-add-set"
                  onClick={() => handleAddSet(exIdx)}
                >
                  + Add Set ({Math.floor(restDurationSec / 60)}:
                  {String(restDurationSec % 60).padStart(2, '0')})
                </button>
              </div>
            </div>
          );
          })}
        </div>
      </div>
      <div className="session-footer">
        <button
          type="button"
          className="session-cancel-btn"
          onClick={onClose}
          title="Cancel workout"
          disabled={finishing}
        >
          Cancel
        </button>
        <button
          type="button"
          className="session-finish-btn"
          onClick={handleFinish}
          disabled={finishing}
          aria-busy={finishing}
          title={finishing ? 'Saving workout…' : 'Finish and save session'}
        >
          <FiPlay size={16} /> {finishing && showSavingLabel ? 'Saving…' : 'Finish'}
        </button>
      </div>
      <ExerciseVideoHelpModal
        open={!!exerciseVideoHelp}
        exerciseName={exerciseVideoHelp?.name}
        videoUrl={exerciseVideoHelp?.url}
        onClose={() => setExerciseVideoHelp(null)}
      />
    </div>
  );
};

export default ActiveWorkoutSession;

