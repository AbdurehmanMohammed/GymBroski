/**
 * Demo / tutorial links for exercises (YouTube).
 * Curated watch links are checked with YouTube oEmbed (public / embeddable videos).
 * Unknown names fall back to a YouTube search for that exercise + proper form.
 */

// Normalize for lookup: lowercase, trim
const key = (name) => (name || '').trim().toLowerCase();

/** Canonical tutorial URLs — update here if a video is ever removed. */
const URL = {
  benchBarbell: 'https://www.youtube.com/watch?v=gRVjAtPip0Y',
  benchInclineBarbell: 'https://www.youtube.com/watch?v=SrqOu55lrYU',
  benchDb: 'https://www.youtube.com/watch?v=QsYre__-aro',
  benchInclineDb: 'https://www.youtube.com/watch?v=8iPEnn-ltC8',
  cableFly: 'https://www.youtube.com/watch?v=JUDTGZh4rhg',
  pushup: 'https://www.youtube.com/watch?v=IODxDxX7oi4',
  deadlift: 'https://www.youtube.com/watch?v=op9kVnSso6Q',
  rowBentBarbell: 'https://www.youtube.com/watch?v=T3N-TO4reLQ',
  latPulldown: 'https://www.youtube.com/watch?v=CAwf7n6Luuc',
  pullup: 'https://www.youtube.com/watch?v=eGo4IYlbE5g',
  facePull: 'https://www.youtube.com/watch?v=rep-qVOkqgk',
  ohpBarbell: 'https://www.youtube.com/watch?v=2yjwXTZQDDI',
  shoulderPressDb: 'https://www.youtube.com/watch?v=fjQdQNjqS1A',
  lateralRaise: 'https://www.youtube.com/watch?v=3VcKaXpzqRo',
  squatBarbell: 'https://www.youtube.com/watch?v=ultWZbUMPL8',
  rdl: 'https://www.youtube.com/watch?v=_oyxCn2iSjU',
  legPress: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ',
  legExtension: 'https://www.youtube.com/watch?v=YyvSfVjQeL0',
  wristCurl: 'https://www.youtube.com/watch?v=qNtgLP9KrJg',
  farmersWalk: 'https://www.youtube.com/watch?v=Fkzk_RqlYTE',
  curlBarbell: 'https://www.youtube.com/watch?v=kwG2ipFRgfo',
  curlHammer: 'https://www.youtube.com/watch?v=zC3nLlEvin4',
  tricepRopePushdown: 'https://www.youtube.com/watch?v=NUmnKw1dWbc',
  skullCrusher: 'https://www.youtube.com/watch?v=tj81tVq3wLo',
  plank: 'https://www.youtube.com/watch?v=pSHjTRCQxIw',
  legRaiseHanging: 'https://www.youtube.com/watch?v=JB2oyawG9KI',
};

// Curated: exercise name (lowercase) → watch URL
const CURATED = {
  // Chest
  'barbell bench press': URL.benchBarbell,
  'incline barbell bench press': URL.benchInclineBarbell,
  'decline barbell bench press': URL.benchBarbell,
  'dumbbell bench press': URL.benchDb,
  'incline dumbbell press': URL.benchInclineDb,
  'incline chest press': URL.benchInclineDb,
  'incline db press': URL.benchInclineDb,
  'decline dumbbell press': URL.benchDb,
  'neutral grip dumbbell press': URL.benchDb,
  'cable chest fly': URL.cableFly,
  'cable crossovers': URL.cableFly,
  'cable crossover': URL.cableFly,
  'low to high cable fly': URL.cableFly,
  'high to low cable fly': URL.cableFly,
  'single arm cable fly': URL.cableFly,
  'push-ups': URL.pushup,
  'wide push-ups': URL.pushup,
  'decline push-ups': URL.pushup,
  'incline push-ups': URL.pushup,
  'diamond push-ups': URL.pushup,
  // Back
  deadlift: URL.deadlift,
  'bent over barbell row': URL.rowBentBarbell,
  'pendlay row': URL.rowBentBarbell,
  'lat pulldown': URL.latPulldown,
  'close grip lat pulldown': URL.latPulldown,
  'wide grip lat pulldown': URL.latPulldown,
  'pull-ups': URL.pullup,
  'chin-ups': URL.pullup,
  'neutral grip pull-ups': URL.pullup,
  'face pull': URL.facePull,
  // Shoulders
  'overhead press': URL.ohpBarbell,
  'dumbbell shoulder press': URL.shoulderPressDb,
  'arnold press': URL.shoulderPressDb,
  'lateral raise': URL.lateralRaise,
  // Legs
  'barbell squat': URL.squatBarbell,
  'romanian deadlift': URL.rdl,
  'stiff leg deadlift': URL.rdl,
  'leg press': URL.legPress,
  'leg extension': URL.legExtension,
  'single leg extension': URL.legExtension,
  // Forearms
  'barbell wrist curl': URL.wristCurl,
  'standing barbell wrist curl': URL.wristCurl,
  'reverse barbell wrist curl': URL.wristCurl,
  'behind the back barbell wrist curl': URL.wristCurl,
  'dumbbell wrist curl': URL.wristCurl,
  'seated dumbbell wrist curl': URL.wristCurl,
  'reverse dumbbell wrist curl': URL.wristCurl,
  'incline dumbbell wrist curl': URL.wristCurl,
  'cable wrist curl': URL.wristCurl,
  'reverse cable wrist curl': URL.wristCurl,
  'rope wrist curl': URL.wristCurl,
  'fat grip barbell curl': URL.curlBarbell,
  "farmer's walk": URL.farmersWalk,
  "farmer's carry": URL.farmersWalk,
  "trap bar farmer's walk": URL.farmersWalk,
  'dead hang': URL.pullup,
  'towel pull-ups': URL.pullup,
  // Arms
  'barbell curl': URL.curlBarbell,
  'ez bar curl': URL.curlBarbell,
  'hammer curl': URL.curlHammer,
  'rope pushdown': URL.tricepRopePushdown,
  'skull crushers': URL.skullCrusher,
  // Core
  plank: URL.plank,
  'hanging leg raise': URL.legRaiseHanging,
};

/**
 * YouTube URL to show for this exercise name (curated or search).
 */
export function getExerciseDemoVideoUrl(exerciseName) {
  const name = (exerciseName || '').trim();
  if (!name) {
    return 'https://www.youtube.com/results?search_query=gym+exercise+proper+form';
  }
  const k = key(name);
  if (CURATED[k]) return CURATED[k];
  const q = encodeURIComponent(`${name} exercise how to proper form`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

/**
 * Prefer curated URL when we have one (fixes stale DB videoUrl from old/broken IDs).
 * Otherwise use saved videoUrl, then YouTube search fallback.
 */
export function resolveExerciseVideoUrl(exercise) {
  const name = exercise?.name;
  const curated = name ? CURATED[key(name)] : null;
  if (curated) return curated;

  const saved = (exercise?.videoUrl || '').trim();
  if (saved) {
    if (/^https?:\/\//i.test(saved)) return saved;
    if (/^(youtu\.be|www\.youtube\.com)/i.test(saved)) return `https://${saved.replace(/^https?:\/\//i, '')}`;
    return saved;
  }
  return getExerciseDemoVideoUrl(name);
}
