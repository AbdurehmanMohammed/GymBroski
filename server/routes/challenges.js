import express from 'express';
import User from '../models/User.js';
import WaterIntake from '../models/WaterIntake.js';
import PersonalRecord from '../models/PersonalRecord.js';
import BodyWeight from '../models/BodyWeight.js';
import ProgressPhoto from '../models/ProgressPhoto.js';
import WorkoutSession from '../models/WorkoutSession.js';
import WorkoutSplit from '../models/WorkoutSplit.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Point values per action (Premier League fantasy style)
export const CHALLENGE_POINTS = {
  workout_completed: 2,
  add_pr: 5,
  log_water: 1,
  log_body_weight: 1,
  add_progress_photo: 3,
  create_public_workout: 5,
  create_private_workout: 2,
  three_day_streak: 5,
  two_workouts_week: 4,
  three_workouts_week: 6,
  four_workouts_week: 8,
  first_workout: 5,
  first_pr: 3,
};

// List of challenges for display
export const CHALLENGES_LIST = [
  { id: 'workout_completed', name: 'Complete a workout', points: CHALLENGE_POINTS.workout_completed, icon: '💪' },
  { id: 'add_pr', name: 'Set a personal record', points: CHALLENGE_POINTS.add_pr, icon: '🏆' },
  { id: 'log_water', name: 'Log water intake', points: CHALLENGE_POINTS.log_water, icon: '💧' },
  { id: 'log_body_weight', name: 'Log body weight', points: CHALLENGE_POINTS.log_body_weight, icon: '⚖️' },
  { id: 'add_progress_photo', name: 'Add progress photo', points: CHALLENGE_POINTS.add_progress_photo, icon: '📸' },
  { id: 'create_public_workout', name: 'Create & share a public workout', points: CHALLENGE_POINTS.create_public_workout, icon: '🌍' },
  { id: 'create_private_workout', name: 'Create a workout split', points: CHALLENGE_POINTS.create_private_workout, icon: '📋' },
  { id: 'three_day_streak', name: '3-day workout streak', points: CHALLENGE_POINTS.three_day_streak, icon: '🔥' },
  { id: 'two_workouts_week', name: '2 workouts in a week', points: CHALLENGE_POINTS.two_workouts_week, icon: '📅' },
  { id: 'three_workouts_week', name: '3 workouts in a week', points: CHALLENGE_POINTS.three_workouts_week, icon: '📅' },
  { id: 'four_workouts_week', name: '4 workouts in a week', points: CHALLENGE_POINTS.four_workouts_week, icon: '📅' },
  { id: 'first_workout', name: 'Complete your first workout', points: CHALLENGE_POINTS.first_workout, icon: '🎯' },
  { id: 'first_pr', name: 'Set your first personal record', points: CHALLENGE_POINTS.first_pr, icon: '⭐' },
];

export async function awardPoints(userId, action) {
  const pts = CHALLENGE_POINTS[action];
  if (!pts) return;
  await User.findByIdAndUpdate(userId, { $inc: { points: pts } });
}

// GET challenges list (public - just the definitions)
router.get('/', (req, res) => {
  res.json(CHALLENGES_LIST);
});

// Category ID -> display name for "top on" badges
const CATEGORY_LABELS = {
  log_water: 'Drinking water',
  add_pr: 'Personal records',
  log_body_weight: 'Body weight',
  add_progress_photo: 'Progress photos',
  workout_completed: 'Workouts completed',
  create_public_workout: 'Public workouts',
  create_private_workout: 'Workout splits',
};

async function getCategoryLeaders() {
  const results = {};

  const runAgg = async (Model, userIdField, categoryId) => {
    const agg = await Model.aggregate([
      { $group: { _id: `$${userIdField}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    if (agg.length && agg[0].count > 0) {
      results[categoryId] = { userId: agg[0]._id?.toString(), count: agg[0].count };
    }
  };

  await Promise.all([
    runAgg(WaterIntake, 'userId', 'log_water'),
    runAgg(PersonalRecord, 'userId', 'add_pr'),
    runAgg(BodyWeight, 'userId', 'log_body_weight'),
    runAgg(ProgressPhoto, 'userId', 'add_progress_photo'),
    runAgg(WorkoutSession, 'userId', 'workout_completed'),
    (async () => {
      const agg = await WorkoutSplit.aggregate([
        { $match: { isPublic: true } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]);
      if (agg.length && agg[0].count > 0) {
        results.create_public_workout = { userId: agg[0]._id?.toString(), count: agg[0].count };
      }
    })(),
    (async () => {
      const agg = await WorkoutSplit.aggregate([
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]);
      if (agg.length && agg[0].count > 0) {
        results.create_private_workout = { userId: agg[0]._id?.toString(), count: agg[0].count };
      }
    })(),
  ]);

  return results;
}

// GET leaderboard - top point scorers (authenticated) with "top on" badges
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const [users, categoryLeaders] = await Promise.all([
      User.find().select('name profilePhoto points').sort({ points: -1 }).limit(50).lean(),
      getCategoryLeaders()
    ]);

    const leaderboard = users.map((u, i) => {
      const topOn = [];
      const uid = u._id?.toString?.() || u._id;
      for (const [catId, data] of Object.entries(categoryLeaders)) {
        if (data?.userId === uid) {
          topOn.push({ id: catId, label: CATEGORY_LABELS[catId], icon: CHALLENGES_LIST.find(c => c.id === catId)?.icon || '🏅' });
        }
      }
      return {
        rank: i + 1,
        userId: u._id,
        name: u.name,
        profilePhoto: u.profilePhoto || '',
        points: u.points || 0,
        topOn,
      };
    });
    res.json(leaderboard);
  } catch (e) {
    console.error('Leaderboard error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST award points (for client-only actions like workout completed)
router.post('/award', authenticateToken, async (req, res) => {
  try {
    const { action } = req.body;
    if (!action || !CHALLENGE_POINTS[action]) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }
    await awardPoints(req.userId, action);
    const user = await User.findById(req.userId).select('points');
    res.json({ success: true, points: user.points });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
