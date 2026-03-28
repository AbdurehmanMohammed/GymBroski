import express from 'express';
import User from '../models/User.js';
import WorkoutSplit from '../models/WorkoutSplit.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/** Rank by challenge points: 1 = highest. Ties share the same rank (competition ranking). */
async function getLeaderboardMetaForPoints(points) {
  const pts = points ?? 0;
  const [higherPointsCount, leaderboardTotalUsers] = await Promise.all([
    User.countDocuments({ points: { $gt: pts } }),
    User.countDocuments({})
  ]);
  return {
    leaderboardRank: higherPointsCount + 1,
    leaderboardTotalUsers
  };
}

// Get another user's public profile (name, profilePhoto, points)
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name profilePhoto points createdAt');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const pts = user.points ?? 0;
    const lb = await getLeaderboardMetaForPoints(pts);
    res.json({
      success: true,
      name: user.name,
      profilePhoto: user.profilePhoto || '',
      points: pts,
      createdAt: user.createdAt || null,
      ...lb
    });
  } catch (error) {
    console.error('Public profile fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get current user profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const pts = user.points ?? 0;
    const lb = await getLeaderboardMetaForPoints(pts);

    res.json({
      success: true,
      name: user.name,
      email: user.email,
      username: user.username || '',
      profilePhoto: user.profilePhoto || '',
      createdAt: user.createdAt,
      points: pts,
      role: user.role || 'user',
      ...lb,
      emailWorkoutReminders: user.emailWorkoutReminders !== false,
      emailChatNotifications: user.emailChatNotifications !== false,
      workoutSchedule: Array.isArray(user.workoutSchedule) ? user.workoutSchedule : [],
      workoutReminderHour: user.workoutReminderHour ?? 8,
      workoutReminderMinute: user.workoutReminderMinute ?? 0,
      timezone: user.timezone || 'UTC'
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Update user profile
router.put('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      profilePhoto,
      emailWorkoutReminders,
      emailChatNotifications,
      workoutSchedule,
      workoutReminderHour,
      workoutReminderMinute,
      timezone
    } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (profilePhoto !== undefined) updateData.profilePhoto = profilePhoto;

    if (typeof emailWorkoutReminders === 'boolean') {
      updateData.emailWorkoutReminders = emailWorkoutReminders;
    }
    if (typeof emailChatNotifications === 'boolean') {
      updateData.emailChatNotifications = emailChatNotifications;
    }
    if (Array.isArray(workoutSchedule)) {
      const cleaned = [];
      const seen = new Set();
      for (const row of workoutSchedule) {
        const day = parseInt(row.day, 10);
        if (Number.isNaN(day) || day < 0 || day > 6) continue;
        if (seen.has(day)) continue;
        const wid = row.workoutId;
        if (!wid || wid === '' || wid === 'null') continue;
        seen.add(day);
        const w = await WorkoutSplit.findOne({ _id: wid, userId: req.userId });
        if (!w) {
          return res.status(400).json({
            success: false,
            message: `Invalid workout for ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}`
          });
        }
        cleaned.push({ day, workoutId: w._id });
      }
      updateData.workoutSchedule = cleaned;
    }
    if (workoutReminderHour !== undefined) {
      const h = parseInt(workoutReminderHour, 10);
      if (!Number.isNaN(h) && h >= 0 && h <= 23) updateData.workoutReminderHour = h;
    }
    if (workoutReminderMinute !== undefined) {
      const m = parseInt(workoutReminderMinute, 10);
      if (!Number.isNaN(m) && m >= 0 && m <= 59) updateData.workoutReminderMinute = m;
    }
    if (timezone !== undefined && typeof timezone === 'string' && timezone.trim()) {
      updateData.timezone = timezone.trim().slice(0, 80);
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const lbAfter = await getLeaderboardMetaForPoints(user.points ?? 0);

    res.json({
      success: true,
      name: user.name,
      email: user.email,
      username: user.username || '',
      profilePhoto: user.profilePhoto || '',
      createdAt: user.createdAt,
      points: user.points ?? 0,
      role: user.role || 'user',
      ...lbAfter,
      emailWorkoutReminders: user.emailWorkoutReminders !== false,
      emailChatNotifications: user.emailChatNotifications !== false,
      workoutSchedule: Array.isArray(user.workoutSchedule) ? user.workoutSchedule : [],
      workoutReminderHour: user.workoutReminderHour ?? 8,
      workoutReminderMinute: user.workoutReminderMinute ?? 0,
      timezone: user.timezone || 'UTC'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

export default router;
