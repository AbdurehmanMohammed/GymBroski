/** Ordinal suffix: 1st, 2nd, 3rd, 4th… */
export function ordinalRank(n) {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

/**
 * Visual tier + funny line for challenge-points leaderboard rank.
 * @param {number} rank — 1 = top
 * @param {number} totalUsers
 */
export function getLeaderboardRankDisplay(rank, totalUsers) {
  const r = Math.max(1, Number(rank) || 1);
  const t = Math.max(1, Number(totalUsers) || 1);

  if (t <= 1) {
    return {
      tier: 'solo',
      medal: '👑',
      headline: 'Main character',
      line: "You're the only row on the spreadsheet. Still counts as #1 energy.",
      meta: 'Challenge points leaderboard',
    };
  }

  const meta = `${ordinalRank(r)} of ${t} members by challenge points`;

  if (r === 1) {
    return {
      tier: 'gold',
      medal: '🥇',
      headline: '1st place — the beast tier',
      line: 'The leaderboard asked for an autograph. Certified chaos in the best way.',
      meta,
    };
  }
  if (r === 2) {
    return {
      tier: 'silver',
      medal: '🥈',
      headline: '2nd place — silver savage',
      line: 'So close to gold the trophy case got nervous.',
      meta,
    };
  }
  if (r === 3) {
    return {
      tier: 'bronze',
      medal: '🥉',
      headline: '3rd place — podium royalty',
      line: 'Bronze ages well. You’re basically vintage gains.',
      meta,
    };
  }
  if (r <= 5) {
    return {
      tier: 'elite',
      medal: '🔥',
      headline: `${ordinalRank(r)} place — elite airspace`,
      line: 'VIP section of the gains table. Bouncers ask for your macros.',
      meta,
    };
  }
  if (r <= 10) {
    return {
      tier: 'top10',
      medal: '💪',
      headline: `${ordinalRank(r)} place — top 10 terror`,
      line: 'Your rest timer is shorter than most people’s attention span.',
      meta,
    };
  }
  if (r <= 25) {
    return {
      tier: 'chaser',
      medal: '🎯',
      headline: `${ordinalRank(r)} place — mid-table marauder`,
      line: 'Still scarier than skipping leg day. Keep stalking the podium.',
      meta,
    };
  }
  if (r <= 50) {
    return {
      tier: 'climber',
      medal: '📈',
      headline: `${ordinalRank(r)} place — climbing crew`,
      line: 'Grinding like Monday leg day: painful, but it builds character.',
      meta,
    };
  }
  if (r <= 100) {
    return {
      tier: 'grinder',
      medal: '⚡',
      headline: `${ordinalRank(r)} place — quiet grind`,
      line: 'The barbell knows your name even if the algorithm barely does.',
      meta,
    };
  }
  return {
    tier: 'rookie',
    medal: '🌱',
    headline: `${ordinalRank(r)} place — plot armor loading`,
    line: 'Every rep counts — especially the ones you almost talked yourself out of.',
    meta,
  };
}
