import React from 'react';
import { FiX, FiInfo } from 'react-icons/fi';

export function ExerciseVideoInfoIcon({ onClick, title = 'How to do this exercise', size = 16 }) {
  return (
    <button
      type="button"
      className="session-exercise-video-btn exercise-preview-video-btn"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      aria-label={title}
      title={title}
    >
      <FiInfo size={size} />
    </button>
  );
}

export function ExerciseVideoHelpModal({ open, exerciseName, videoUrl, onClose }) {
  if (!open || !videoUrl) return null;
  return (
    <div
      className="workout-video-help-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-video-help-title"
      onClick={onClose}
    >
      <div className="workout-video-help-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="workout-video-help-close" onClick={onClose} aria-label="Close">
          <FiX size={22} />
        </button>
        <h3 id="exercise-video-help-title" className="workout-video-help-title">
          {exerciseName}
        </h3>
        <p className="workout-video-help-text">
          To see how to do <strong>{exerciseName}</strong>, click the link below — it opens YouTube (tutorial or
          search results).
        </p>
        <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="workout-video-help-link">
          Click here to watch →
        </a>
      </div>
    </div>
  );
}
