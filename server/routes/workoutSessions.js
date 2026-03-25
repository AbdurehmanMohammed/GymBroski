import express from 'express';
import WorkoutSession from '../models/WorkoutSession.js';
import { authenticateToken } from '../middleware/auth.js';
import { awardPoints } from './challenges.js';

const router = express.Router();

router.use(authenticateToken);

function getWeekBounds(weekOffset = 0) {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return { start: monday.toISOString().slice(0, 10), end: nextMonday.toISOString().slice(0, 10) };
}

// GET workout session stats for Progress page (per-user, from DB)
router.get('/stats', async (req, res) => {
  try {
    const sessions = await WorkoutSession.find({ userId: req.userId })
      .select('dateISO createdAt')
      .lean();

    const dates = [...new Set(sessions.map((s) => s.dateISO || s.createdAt?.toISOString?.()?.slice(0, 10)).filter(Boolean))];

    const { start: weekStart, end: weekEnd } = getWeekBounds(0);
    const { start: lastWeekStart, end: lastWeekEnd } = getWeekBounds(-1);

    const daysThisWeek = dates.filter((d) => d >= weekStart && d < weekEnd).length;
    const daysLastWeek = dates.filter((d) => d >= lastWeekStart && d < lastWeekEnd).length;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1).toISOString().slice(0, 10);

    const daysThisMonth = dates.filter((d) => d >= monthStart && d < monthEnd).length;
    const daysThisYear = dates.filter((d) => d >= yearStart && d < yearEnd).length;

    res.json({
      totalCompleted: sessions.length,
      daysThisWeek,
      daysLastWeek,
      daysThisMonth,
      daysThisYear
    });
  } catch (error) {
    console.error('Get workout stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching stats'
    });
  }
});

// GET all workout sessions for the logged-in user
router.get('/', async (req, res) => {
  try {
    const sessions = await WorkoutSession.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(sessions);
  } catch (error) {
    console.error('Get workout sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching workout history'
    });
  }
});

// POST create a new workout session (when user finishes a workout)
router.post('/', async (req, res) => {
  try {
    const { workoutName, workoutId, dateStr, dateISO, durationSec, totalVolume, exerciseBreakdown, prs } = req.body;

    if (!workoutName || !dateStr || !dateISO) {
      return res.status(400).json({
        success: false,
        message: 'workoutName, dateStr, and dateISO are required'
      });
    }

    const session = new WorkoutSession({
      userId: req.userId,
      workoutName,
      workoutId: workoutId || null,
      dateStr,
      dateISO,
      durationSec: durationSec ?? 0,
      totalVolume: totalVolume ?? 0,
      exerciseBreakdown: exerciseBreakdown ?? [],
      prs: prs ?? []
    });

    await session.save();
    const totalCount = await WorkoutSession.countDocuments({ userId: req.userId });

    await awardPoints(req.userId, 'workout_completed');
    if (totalCount === 1) await awardPoints(req.userId, 'first_workout');

    /** Distinct training days only — faster than loading every session row for streak math */
    const uniqueDates = (await WorkoutSession.distinct('dateISO', { userId: req.userId })).filter(
      Boolean
    );
    uniqueDates.sort();

    const getConsecutiveFromToday = (dates) => {
      if (!dates.length) return 0;
      let streak = 0;
      const d = new Date();
      for (let i = 0; i < 14; i++) {
        const dStr = d.toISOString().slice(0, 10);
        if (dates.includes(dStr)) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else break;
      }
      return streak;
    };
    const streak = getConsecutiveFromToday(uniqueDates);
    if (streak === 3) await awardPoints(req.userId, 'three_day_streak');

    const day = new Date().getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const thisWeekCount = uniqueDates.filter((d) => d >= weekStartStr && d < weekEndStr).length;
    if (thisWeekCount === 2) await awardPoints(req.userId, 'two_workouts_week');
    if (thisWeekCount === 3) await awardPoints(req.userId, 'three_workouts_week');
    if (thisWeekCount === 4) await awardPoints(req.userId, 'four_workouts_week');

    res.status(201).json({ ...session.toObject(), workoutCount: totalCount });
  } catch (error) {
    console.error('Create workout session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error saving workout'
    });
  }
});

// DELETE all workout sessions for the user
router.delete('/', async (req, res) => {
  try {
    const result = await WorkoutSession.deleteMany({ userId: req.userId });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Delete all workout sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting history'
    });
  }
});

// DELETE single workout session
router.delete('/:id', async (req, res) => {
  try {
    const session = await WorkoutSession.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete workout session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting workout'
    });
  }
});

export default router;
