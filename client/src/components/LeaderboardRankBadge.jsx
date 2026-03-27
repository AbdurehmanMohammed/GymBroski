import React from 'react';
import { getLeaderboardRankDisplay } from '../utils/leaderboardRankFlavor';

export default function LeaderboardRankBadge({ rank, totalUsers }) {
  const d = getLeaderboardRankDisplay(rank, totalUsers);
  return (
    <div
      className={`user-profile-rank-badge user-profile-rank-badge--${d.tier}`}
      role="status"
      aria-label={`${d.headline}. ${d.meta}`}
    >
      <span className="user-profile-rank-badge__medal" aria-hidden>
        {d.medal}
      </span>
      <div className="user-profile-rank-badge__body">
        <p className="user-profile-rank-badge__headline">{d.headline}</p>
        <p className="user-profile-rank-badge__line">{d.line}</p>
        <p className="user-profile-rank-badge__meta">{d.meta}</p>
      </div>
    </div>
  );
}
