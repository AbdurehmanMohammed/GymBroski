import { randomInt } from 'crypto';
import { DateTime } from 'luxon';
import User from '../models/User.js';
import WorkoutSplit from '../models/WorkoutSplit.js';
import { sendMail } from '../services/mail.js';

const APP_NAME = process.env.APP_PUBLIC_NAME || 'GymBruski Website';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

const MOTIVATIONAL = [
  'Show up for yourself today — one session at a time.',
  'Consistency beats perfection. You’ve got this.',
  'The bar doesn’t care about yesterday. Own this workout.',
  'Strong isn’t a look — it’s a decision you make today.',
  'Progress is built rep by rep. Let’s move.',
  'Your future self will thank you for starting.',
  'Energy flows where focus goes — lock in.',
  'Small steps today, big gains tomorrow.',
  'You don’t have to feel ready — you just have to start.',
  'Discipline is remembering what you want when it gets hard.',
  'The only bad workout is the one that didn’t happen.',
  'One hour from now you’ll be glad you went.',
  'Motion beats motivation — start moving and the mood follows.',
  'You’re one workout away from a better mood.',
  'Sweat is just your body applauding in liquid form.',
  'Train like nobody’s watching; progress like everybody will notice.',
  'Winners show up tired too. Difference is — they still show up.',
  'The plan works if you work the plan.',
  'Brick by brick — that’s how castles and PRs get built.',
  'You can’t cheat the grind; it knows.',
  'Time to get after it — no cap, you’re built for this.',
  'Main character energy today: walk in, work hard, walk out proud.',
  'Send it. Respectfully.',
  'We’re not asking the weights for permission today.',
  'Lock in — headphones on, world off, reps in.',
  'That “later” becomes never real quick. Not today.',
  'You’re in your training era. Keep that same energy.',
  'It’s giving discipline. It’s giving gains.',
  'We don’t skip the warm-up sets; we don’t skip life either.',
  'Real ones finish the program — be a real one today.',
  'Lowkey this workout might slap. Highkey you will too.',
  'Stay hungry — but maybe eat after. Protein matters.',
  'Yeah buddy — light weight! (Okay maybe not light, but you’ve still got this.)',
  'Everybody wants the results; today you’re doing the work. That’s the difference.',
  'Ain’t nothin’ to it but to do it — one set at a time.',
  'Treat every rep like it owes you money.',
  'The iron doesn’t lie — show up honest and it’ll meet you halfway.',
  'Another day, another chance to outlift yesterday’s excuses.',
  'Somewhere out there, a legend started with one ugly set. Yours is today.',
  'The weights are neutral — you bring the story. Make it a good one.',
  'Champions are made when the gym is empty and the playlist hits anyway.',
  'Courage isn’t the absence of fear — it’s training anyway.',
  'You can’t pour from an empty cup; movement fills yours back up.',
  'Invest in your body the way you wish you’d invested earlier — starting now counts.',
  'Hard choices, easy life. You’re choosing the hard thing on purpose. Respect.',
  'Comfort zones don’t grow you; the gym is a classroom with dumbbells.',
  'What you do daily matters more than what you do once in a while.',
  'Patience is a muscle — train it alongside everything else.',
  'Your habits are voting for the person you’re becoming. Cast a strong vote.',
  'Regret weighs more than any barbell. Lift this instead.',
  'Be the kind of person your younger self needed to see.',
  'Strength isn’t just muscle — it’s keeping promises to yourself.',
  'Small integrity wins: you said you’d train. Keep the word.',
  'The best project you’ll ever work on is you.',
  'Leg day called. It said stop pretending you didn’t see this.',
  'Skipping legs? The stairs tomorrow remember. Be kind to future you.',
  'Your couch will still love you after — but your goals need you first.',
  'Cardio is just spicy walking. You’ve survived worse.',
  'That pre-workout hasn’t kicked in yet? Perfect — you’ll be warm by set two.',
  'If the gym playlist hits, you’re basically obligated to PR. Rules are rules.',
  'Rest days are earned. Today is probably not that day. (Unless it is — then chill.)',
  'Remember: the heaviest weight at the gym is sometimes just the front door. You already opened it.',
  'Leg day: because walking normally tomorrow is overrated anyway.',
  'Your quads didn’t text back — they’re waiting in the squat rack.',
  'Bench wants hugs; legs want revenge. Guess which one you’ve been avoiding?',
  'Abs are made in the kitchen; excuses are made on the couch. Pick your kitchen.',
  'That one weird machine nobody uses? It’s judging you softly. Use something.',
  'If your gym bag smells like victory and old socks, you’re doing it right.',
  'Spotter optional; showing up mandatory.',
  'Mirror check: you look like someone who keeps promises. Prove it.',
  'DOMS is just your muscles sending thank-you notes in Morse code.',
  'You don’t need a perfect plan — you need a willing body and a timer.',
  'Hydrate like you respect yourself. Then lift like you mean it.',
  'Two truths: water helps, and nobody ever regretted the last set they finished.',
  'Mobility matters — so does not turning into a desk pretzel. Move.',
  'Progress photos hate this one trick: actually training consistently.',
  'Your competition isn’t strangers on the feed — it’s yesterday’s quit voice.',
  'Rerack your weights; rerack your excuses while you’re at it.',
  'Grip it, rip it (with good form), repeat.',
  'Tempo reps are just the gym saying “read the fine print.”',
  'Drop sets aren’t a personality — but today they can be yours.',
  'Farmer carries: because groceries and grip strength shouldn’t be separate hobbies.',
  'Face pulls for posture; ego pulls for nothing good.',
  'Stretching isn’t boring — it’s the DLC for longevity.',
  'Sleep is the real secret supplement. Still — train first.',
  'If you can laugh mid-set, you’re either winning or about to.',
  'Gym crush who? You’re crushing the session.',
  'That “I’ll start Monday” energy expires — today is a perfectly good Monday.',
  'Calendar said workout; calendar doesn’t negotiate.',
  'You’re not too busy — you’re prioritizing. Make this one count.',
  'One more rep is a love letter to future you. Mail it.',
  'Sore tomorrow > sorry tomorrow.',
  'Beast mode is a dial, not a switch — turn it up gradually and safely.',
  'Iron therapy: cheaper than retail therapy, heavier in the best way.',
  'You didn’t come this far to only come this far — add a set.',
  'Confidence loads plates faster than doubt. Spot the difference.',
  'Mind-muscle connection: tell your brain the gym is not optional today.',
  'PRs are optional; showing up is the real flex.',
  'Train the weakness before it trains you.',
  'Weak points are just future strong points in disguise.',
  'The gym is the one place effort always shows up on the receipt.',
  'You’re not lifting for the gram — you’re lifting for gravity. It’s undefeated; train accordingly.',
  'Plate math is temporary; the story you tell yourself is permanent. Make it a good one.',
  'If your inner voice is rude, outlift it politely with reps.',
  'Sweat now, swagger later — both are optional, but only one ages well.',
  'Your alarm clock did its job; now do yours.',
  'The barbell is a therapist that only speaks in sets and RPE.',
  'Skip the scroll, hit the goal — thumbs get enough reps already.',
  'You can’t microwave mastery; you can microwave a meal after though.',
  'Muscles don’t care about your mood; they care about tension and time.',
  'Be so consistent that “rest day” feels like a plot twist.',
  'If it burns, you’re in the right zip code — breathe and finish the set.',
  'Nobody posts their warm-up sets; everyone needs them. Do yours.',
  'You’re one good session away from resetting a bad week.',
  'The pump fades; the habit stays — invest in the boring stuff.',
  'Talk is cheap; plates are priced per kilo. Pay the toll.',
  'Your future PR is watching today’s choices like a hawk.',
  'Legs are not “optional DLC” — they’re the base game.',
  'Squat depth > opinion depth. Keep both honest.',
  'Hamstrings hold grudges. Stretch them before they sue.',
  'Calves are stubborn; treat them like a negotiation, not a debate.',
  'Glutes don’t activate from wishes — bridges, hinges, and attitude.',
  'If the stairwell feels personal tomorrow, you trained legs right.',
  'Bench is not a personality — but good arch and leg drive help.',
  'Pull day: because the world already pulls you enough; pull back.',
  'Rows today, bro — posture tomorrow.',
  'Lats wide, excuses narrow.',
  'Biceps are the cherry; pulling strength is the cake.',
  'Triceps make the lockout; ego makes the fail video. Choose wisely.',
  'Shoulders love volume and hate impatience — same as most good things.',
  'Core work: so you can stand tall when life tries to fold you.',
  'Cardio doesn’t steal gains; skipping sleep and food does.',
  'Zone 2 is just vibing with extra steps — romantic, really.',
  'Treadmill: a conveyor belt of discipline.',
  'Bike, row, run — pick your fighter; just pick one sometimes.',
  'Mobility is the interest payment on lifting debt. Pay early.',
  'Foam rolling hurts because it’s honest. Listen, don’t negotiate.',
  'Warm up like you respect your joints; they’ve carried you this far.',
  'Cool down like you plan to train again — because you do.',
  'Deload weeks are not quitting; they’re reloading the save file.',
  'Progress isn’t linear; it’s a crooked line that still goes up.',
  'Compare you to you — the feed is a highlight reel, not a ruler.',
  'PRs are fun; adherence is the real boss fight.',
  'Two plates or two years of consistency — consistency wins every time.',
  'You don’t need hype; you need a habit that survives boredom.',
  'Boring programs done consistently beat sexy programs done never.',
  'Track something simple: sessions completed this month. Win that game.',
  'If you trained on a bad day, you’re officially harder to break.',
  'Stress is a set you didn’t choose; training is one you did.',
  'Anger is fuel; form is the steering wheel — use both safely.',
  'Joy is also fuel — dance between sets if nobody’s looking.',
  'Music loud, excuses quiet.',
  'If the gym is crowded, patience is part of the workout.',
  'Share the rack; karma racks plates for you later.',
  'Wipe the bench — character reps count too.',
  'Put the dumbbells back; your integrity has a home address.',
  'Film from the side; ego from the front — only one helps your squat.',
  'Depth checks aren’t drama; they’re data.',
  'Half reps, half respect — you’re worth full range.',
  'Tempo 3-1-2 isn’t a vibe kill; it’s a strength bill coming due.',
  'Pause reps: the gym’s way of saying “prove it.”',
  'Cluster sets: because rest is a suggestion and you’re stubborn.',
  'AMRAP: as many reasons as possible to be proud after.',
  'Supersets: when one muscle rests, another works — teamwork.',
  'Giant sets: chaos with a spreadsheet.',
  'Failure reps: educational, not every day — pass the class wisely.',
  'RPE honest, ego humble, bar path clean.',
  'If you can’t brace, you can’t brag — breathe and tighten.',
  'Grip failing? Forearms are filing a complaint; listen.',
  'Chalk is makeup for lifters — a little drama, better performance.',
  'Belt isn’t cheating; it’s a tool — like shoes, not like a scooter.',
  'Straps for back day: your grip isn’t your spinal erectors’ boss.',
  'Shoes flat, intentions flatter — still lift heavy.',
  'Hydration check before flex check.',
  'Electrolytes: because cramps are a bad plot twist.',
  'Protein: the legal performance enhancer you keep “forgetting.”',
  'Carbs aren’t the enemy; skipping training consistency is.',
  'Sleep: the free steroid nobody stocks.',
  'Morning person or not — the iron opens on time.',
  'Night owl lifter? Still counts. The calendar doesn’t judge.',
  'Travel gains: hotel gym humility builds character.',
  'Home workout: fewer machines, same decision — show up.',
  'Outdoor run: sun, wind, and a free side of gratitude.',
  'Rain run: main character in a music video energy.',
  'Snow shovel counts as unplanned farmer carries — life’s funny.',
  'Stairs after leg day: the building’s passive-aggressive coach.',
  'Elevator after leg day: self-care, not shame.',
  'Stretching in socks: slippery ego, safer hips.',
  'Yoga mat: where flex meets flexibility.',
  'Pilates core: sneaky hard, publicly humble.',
  'Swim day: cardio that whispers instead of screams.',
  'Hike day: legs meet views — worth the DOMS.',
  'Bike commute: saving gas, spending quads.',
  'Dog walk PR: steps count if your heart rate says so.',
  'Kid on your shoulders: ultimate overhead carry PR.',
  'Moving apartments: accidental strongman event — recover smart.',
  'Desk job neck: face pulls are your union rep.',
  'Thumb scroll neck: look up; the ceiling misses you.',
  'Posture check: ears over shoulders, not over your phone.',
  'Breath in nose, brace, exhale on effort — simple spell, strong magic.',
];

function luxonToJsWeekday(lw) {
  return lw === 7 ? 0 : lw;
}

function firstName(full) {
  if (!full || !String(full).trim()) return 'champion';
  return String(full).trim().split(/\s+/)[0];
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inReminderWindow(now, hour, minute, windowMinutes = 35) {
  const start = now.set({ hour, minute, second: 0, millisecond: 0 });
  const end = start.plus({ minutes: windowMinutes });
  return now >= start && now < end;
}

/** Same as the original job: one server-wide send time (default 6:00 local). */
function getEnvReminderTime() {
  const envH = parseInt(process.env.WORKOUT_REMINDER_DAY_START_HOUR ?? '6', 10);
  const envM = parseInt(process.env.WORKOUT_REMINDER_DAY_START_MINUTE ?? '0', 10);
  return {
    hour: Number.isNaN(envH) ? 6 : Math.min(23, Math.max(0, envH)),
    minute: Number.isNaN(envM) ? 0 : Math.min(59, Math.max(0, envM)),
  };
}

/**
 * Per-user time from profile only when WORKOUT_REMINDER_TRUST_SAVED_TIME=true.
 * Otherwise we use getEnvReminderTime() for everyone — matches the original behavior before profile hours
 * were wired in (many users still have Mongoose’s old default 8:00 in DB, which moved the send window).
 */
function getReminderTimeForUser(u) {
  if (process.env.WORKOUT_REMINDER_TRUST_SAVED_TIME !== 'true') {
    return getEnvReminderTime();
  }

  const fallback = getEnvReminderTime();
  const rawH = u.workoutReminderHour;
  const rawM = u.workoutReminderMinute;
  // null / undefined / '' — not set; never treat null as 0 for hour (Number(null) === 0 would hit midnight).
  if (rawH == null || rawH === '') {
    return fallback;
  }
  const h = Number(rawH);
  if (!Number.isFinite(h) || h < 0 || h > 23) {
    return fallback;
  }
  let m = 0;
  if (rawM != null && rawM !== '') {
    const n = Number(rawM);
    if (Number.isFinite(n) && n >= 0 && n <= 59) {
      m = n;
    }
  }
  return { hour: h, minute: m };
}

/** Cryptographic random index — each reminder email gets an independent random line. */
function pickMotivation() {
  const n = MOTIVATIONAL.length;
  if (n === 0) return 'Show up for yourself today — one session at a time.';
  return MOTIVATIONAL[randomInt(n)];
}

const DEBUG = process.env.WORKOUT_REMINDER_DEBUG === 'true';

function dbg(email, msg) {
  if (DEBUG && email) console.log('[workoutReminders]', email, msg);
}

export async function runWorkoutReminderJob() {
  if (process.env.WORKOUT_REMINDER_CRON === 'false') {
    return { ran: false, reason: 'disabled' };
  }

  const users = await User.find({ emailWorkoutReminders: { $ne: false } })
    .select(
      'email name emailWorkoutReminders workoutSchedule workoutReminderHour workoutReminderMinute timezone lastWorkoutReminderSentOn'
    )
    .lean();

  let sent = 0;

  for (const u of users) {
    const logEmail = u.email || String(u._id);

    if (!Array.isArray(u.workoutSchedule) || u.workoutSchedule.length === 0) {
      dbg(logEmail, 'skip: no workout schedule (assign days when you create or edit a workout)');
      continue;
    }

    const tz = u.timezone?.trim() || 'UTC';
    let now;
    try {
      now = DateTime.now().setZone(tz);
    } catch {
      console.warn('[workoutReminders] bad timezone — fix in Profile:', tz, u._id);
      continue;
    }

    const jsDow = luxonToJsWeekday(now.weekday);
    const sched = Array.isArray(u.workoutSchedule) ? u.workoutSchedule : [];
    const entry = sched.find((s) => Number(s.day) === jsDow);
    if (!entry || !entry.workoutId) {
      dbg(
        logEmail,
        `skip: no workout for today (weekday ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][jsDow]} in ${tz})`
      );
      continue;
    }

    const wid = entry.workoutId?._id ?? entry.workoutId;

    const { hour: h, minute: m } = getReminderTimeForUser(u);
    if (!inReminderWindow(now, h, m)) {
      dbg(
        logEmail,
        `skip: not in reminder window (local ${now.toFormat('HH:mm')}; send time ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${tz}, 35 min window — set WORKOUT_REMINDER_TRUST_SAVED_TIME=true to use Profile / schedule picker times)`
      );
      continue;
    }

    const todayKey = now.toFormat('yyyy-MM-dd');
    if (u.lastWorkoutReminderSentOn === todayKey) {
      dbg(logEmail, 'skip: already sent today');
      continue;
    }

    const workout = await WorkoutSplit.findOne({
      _id: wid,
      userId: u._id
    }).lean();

    if (!workout) {
      console.warn('[workoutReminders] skip: workout not found for id', wid, logEmail);
      continue;
    }

    const greet = firstName(u.name);
    const wname = workout.name || 'Your workout';
    const desc = (workout.description || '').trim();
    const exCount = Array.isArray(workout.exercises) ? workout.exercises.length : 0;
    const motivation = pickMotivation();

    const subject = `🏋️ ${APP_NAME} — ${wname} today`;
    const html = `
      <p>Hi <strong>${escapeHtml(greet)}</strong>,</p>
      <p>Today you’re scheduled for <strong>${escapeHtml(wname)}</strong>.</p>
      ${desc ? `<p style="color:#334155;">${escapeHtml(desc)}</p>` : ''}
      ${exCount ? `<p>${exCount} exercise${exCount === 1 ? '' : 's'} in this split — open the app when you’re ready.</p>` : ''}
      <p style="margin:20px 0;padding:14px 16px;background:#f1f5f9;border-radius:10px;border-left:4px solid #6366f1;font-style:italic;color:#334155;">
        ${escapeHtml(motivation)}
      </p>
      <p><a href="${APP_URL}/dashboard" style="color:#4f46e5;font-weight:600;">Open ${escapeHtml(APP_NAME)} →</a></p>
      <p style="color:#94a3b8;font-size:12px;">You’re receiving this because workout reminders are on in your profile. Send time follows the app’s schedule (and your time zone).</p>
    `;

    const text = `Hi ${greet}, today you're scheduled for "${wname}". ${motivation} ${APP_URL}/dashboard`;

    const result = await sendMail({ to: u.email, subject, html, text });
    if (result.skipped || !result.ok) {
      console.warn(
        '[workoutReminders] email NOT sent:',
        logEmail,
        result.skipped ? '(set RESEND_API_KEY + EMAIL_FROM)' : result.error || 'unknown'
      );
      continue;
    }

    await User.updateOne({ _id: u._id }, { $set: { lastWorkoutReminderSentOn: todayKey } });
    sent++;
    console.log('[workoutReminders] sent workout email to', logEmail);
  }

  return { ran: true, checked: users.length, sent };
}
