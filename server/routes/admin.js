import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import WorkoutSplit from '../models/WorkoutSplit.js';
import WorkoutSession from '../models/WorkoutSession.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import ProgressPhoto from '../models/ProgressPhoto.js';
import BodyWeight from '../models/BodyWeight.js';
import WaterIntake from '../models/WaterIntake.js';
import PersonalRecord from '../models/PersonalRecord.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { deleteUserAndAllRelatedData } from '../services/userCascadeDelete.js';
import { notifyAdmins, invalidateUserSession, disconnectUserSockets } from '../realtime/adminHub.js';
import {
  isStrongPassword,
  PASSWORD_REQUIREMENTS,
  isPlatformAdminPasswordOk,
  PLATFORM_ADMIN_PASSWORD_MIN,
} from '../utils/passwordPolicy.js';

const router = express.Router();

const isValidEmailFormat = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const reservedPlatformEmail = () =>
  String(
    process.env.ADMIN_ACCOUNT_EMAIL || 'platform-admin@internal.gymbruski.app'
  )
    .trim()
    .toLowerCase();

function isPlatformAdminAccountDoc(user) {
  if (!user) return false;
  const un = String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const em = reservedPlatformEmail();
  const hasUn = user.username && String(user.username).toLowerCase() === un;
  const hasEm = String(user.email || '').toLowerCase() === em;
  return Boolean(hasUn || hasEm);
}

router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [
      userCount,
      adminCount,
      suspendedCount,
      workoutCount,
      sessionCount,
      messageCount,
      conversationCount,
      progressPhotoCount,
      bodyWeightCount,
      waterIntakeCount,
      personalRecordCount,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ suspended: true }),
      WorkoutSplit.countDocuments(),
      WorkoutSession.countDocuments(),
      Message.countDocuments(),
      Conversation.countDocuments(),
      ProgressPhoto.countDocuments(),
      BodyWeight.countDocuments(),
      WaterIntake.countDocuments(),
      PersonalRecord.countDocuments(),
    ]);
    res.json({
      success: true,
      stats: {
        userCount,
        adminCount,
        suspendedCount,
        workoutCount,
        sessionCount,
        messageCount,
        conversationCount,
        progressPhotoCount,
        bodyWeightCount,
        waterIntakeCount,
        personalRecordCount,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/activity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentSignups, messages24h] = await Promise.all([
      User.find({ createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(12)
        .select('name email createdAt role suspended')
        .lean(),
      Message.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    ]);
    res.json({
      success: true,
      recentSignups: recentSignups.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        role: u.role || 'user',
        suspended: Boolean(u.suspended),
      })),
      messagesLast24h: messages24h,
    });
  } catch (error) {
    console.error('Admin activity error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/** Remove every chat message; keeps conversation records (empty). Requires explicit confirmation phrase. */
router.post('/chat/clear-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (String(req.body?.confirm || '') !== 'DELETE_ALL_CHAT') {
      return res.status(400).json({
        success: false,
        message: 'Send JSON body { "confirm": "DELETE_ALL_CHAT" }.',
      });
    }
    const del = await Message.deleteMany({});
    await Conversation.updateMany({}, { $set: { lastMessageAt: new Date(0), lastReadAt: [] } });
    notifyAdmins({ reason: 'chat.cleared_all', deletedCount: del.deletedCount });
    res.json({
      success: true,
      message: 'All chat messages removed.',
      deletedMessages: del.deletedCount,
    });
  } catch (error) {
    console.error('Admin clear chat error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      users: users.map((u) => ({
        id: u._id,
        email: u.email,
        name: u.name,
        role: u.role || 'user',
        points: u.points ?? 0,
        username: u.username || '',
        profilePhoto: u.profilePhoto || '',
        createdAt: u.createdAt,
        suspended: Boolean(u.suspended),
        isPlatformAdmin: isPlatformAdminAccountDoc(u),
      })),
    });
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/users/:userId/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    const [workoutTemplates, sessions, photos, prs] = await Promise.all([
      WorkoutSplit.countDocuments({ userId }),
      WorkoutSession.countDocuments({ userId }),
      ProgressPhoto.countDocuments({ userId }),
      PersonalRecord.countDocuments({ userId }),
    ]);
    res.json({
      success: true,
      summary: { workoutTemplates, sessions, progressPhotos: photos, personalRecords: prs },
    });
  } catch (error) {
    console.error('Admin user summary error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    const user = await User.findById(userId).select('-password').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        username: user.username || '',
        name: user.name,
        role: user.role || 'user',
        points: user.points ?? 0,
        profilePhoto: user.profilePhoto || '',
        createdAt: user.createdAt,
        emailWorkoutReminders: user.emailWorkoutReminders !== false,
        emailChatNotifications: user.emailChatNotifications !== false,
        workoutSchedule: Array.isArray(user.workoutSchedule) ? user.workoutSchedule : [],
        workoutReminderHour: user.workoutReminderHour ?? 8,
        workoutReminderMinute: user.workoutReminderMinute ?? 0,
        timezone: user.timezone || 'UTC',
        suspended: Boolean(user.suspended),
        isPlatformAdmin: isPlatformAdminAccountDoc(user),
      },
    });
  } catch (error) {
    console.error('Admin get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/users/:userId/profile', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const target = await User.findById(userId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const {
      name,
      email,
      profilePhoto,
      emailWorkoutReminders,
      emailChatNotifications,
      workoutSchedule,
      workoutReminderHour,
      workoutReminderMinute,
      timezone,
    } = req.body;

    const updateData = {};

    if (name !== undefined) {
      const n = String(name).trim();
      if (n.length < 1 || n.length > 120) {
        return res.status(400).json({ success: false, message: 'Name must be 1–120 characters.' });
      }
      updateData.name = n;
    }

    if (email !== undefined) {
      const e = String(email).trim().toLowerCase();
      if (!isValidEmailFormat(e)) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
      }
      const reserved = reservedPlatformEmail();
      if (e === reserved && String(target.email).toLowerCase() !== reserved) {
        return res.status(400).json({
          success: false,
          message: 'That email is reserved for the platform admin account.',
        });
      }
      const taken = await User.findOne({ email: e, _id: { $ne: userId } });
      if (taken) {
        return res.status(400).json({ success: false, message: 'Email already in use.' });
      }
      updateData.email = e;
    }

    if (profilePhoto !== undefined) {
      updateData.profilePhoto = typeof profilePhoto === 'string' ? profilePhoto : '';
    }
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
        const w = await WorkoutSplit.findOne({ _id: wid, userId });
        if (!w) {
          return res.status(400).json({
            success: false,
            message: `Invalid workout for ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}`,
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

    if (!Object.keys(updateData).length) {
      return res.status(400).json({ success: false, message: 'No valid fields to update.' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    notifyAdmins({ reason: 'user.profile', userId });

    res.json({
      success: true,
      message: 'Profile updated.',
      user: {
        id: user._id,
        email: user.email,
        username: user.username || '',
        name: user.name,
        role: user.role || 'user',
        profilePhoto: user.profilePhoto || '',
        emailWorkoutReminders: user.emailWorkoutReminders !== false,
        emailChatNotifications: user.emailChatNotifications !== false,
        workoutSchedule: Array.isArray(user.workoutSchedule) ? user.workoutSchedule : [],
        workoutReminderHour: user.workoutReminderHour ?? 8,
        workoutReminderMinute: user.workoutReminderMinute ?? 0,
        timezone: user.timezone || 'UTC',
        suspended: Boolean(user.suspended),
      },
    });
  } catch (error) {
    console.error('Admin patch profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/users/:userId/password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const newPassword = req.body?.newPassword ?? req.body?.password;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const str = String(newPassword || '');
    if (isPlatformAdminAccountDoc(user)) {
      if (!isPlatformAdminPasswordOk(str)) {
        return res.status(400).json({
          success: false,
          message: `Platform admin password must be at least ${PLATFORM_ADMIN_PASSWORD_MIN} characters.`,
        });
      }
    } else if (!isStrongPassword(str)) {
      return res.status(400).json({ success: false, message: PASSWORD_REQUIREMENTS });
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(String(newPassword), salt);
    await user.save();
    notifyAdmins({ reason: 'user.password', userId });
    res.json({ success: true, message: 'Password updated. Ask the user to sign in with the new password.' });
  } catch (error) {
    console.error('Admin set password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/users/:userId/suspend', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    const suspended = Boolean(req.body?.suspended);
    const target = await User.findById(userId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (isPlatformAdminAccountDoc(target)) {
      return res.status(400).json({
        success: false,
        message: 'The platform admin account cannot be suspended.',
      });
    }
    if (String(userId) === String(req.userId)) {
      return res.status(400).json({ success: false, message: 'You cannot suspend your own account.' });
    }
    target.suspended = suspended;
    await target.save();
    if (suspended) {
      invalidateUserSession(userId, { reason: 'account_suspended', email: target.email });
      await disconnectUserSockets(userId);
    }
    notifyAdmins({ reason: suspended ? 'user.suspended' : 'user.unsuspended', userId, email: target.email });
    res.json({
      success: true,
      message: suspended ? 'User suspended.' : 'Suspension removed.',
      suspended: target.suspended,
    });
  } catch (error) {
    console.error('Admin suspend error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/** Set challenge points for a user (leaderboard). */
router.patch('/users/:userId/points', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const raw = req.body?.points;
    const points = Number(raw);
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    if (!Number.isFinite(points) || points < 0 || points > 1e9) {
      return res.status(400).json({
        success: false,
        message: 'points must be a number between 0 and 1e9',
      });
    }
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { points: Math.floor(points) } },
      { new: true, runValidators: true }
    ).select('points email name');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    notifyAdmins({ reason: 'user.points', userId });
    res.json({
      success: true,
      message: 'Points updated.',
      points: user.points,
      user: { id: user._id, email: user.email, name: user.name, points: user.points },
    });
  } catch (error) {
    console.error('Admin set points error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/users/:userId/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const role = String(req.body?.role || '').trim();
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'role must be "user" or "admin"' });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    if (String(userId) === String(req.userId) && role === 'user') {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own admin role.',
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { role } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    notifyAdmins({ reason: 'user.role', userId, role: user.role });
    res.json({
      success: true,
      message: 'Role updated.',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Admin set role error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Delete a user and all related data (cascade).
 * - Logged-in admin: Bearer JWT (cannot delete own account).
 * - Legacy: X-Admin-Secret when ADMIN_DELETE_SECRET is set (automation / emergencies).
 */
function allowDeleteViaLegacyOrAdmin(req, res, next) {
  const legacySecret = String(process.env.ADMIN_DELETE_SECRET || '').trim();
  const providedLegacy = String(req.headers['x-admin-secret'] || '').trim();
  if (legacySecret && providedLegacy === legacySecret) {
    req.adminDeleteViaLegacySecret = true;
    return next();
  }
  authenticateToken(req, res, () => requireAdmin(req, res, next));
}

router.delete('/users/:userId', allowDeleteViaLegacyOrAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    if (!req.adminDeleteViaLegacySecret && String(userId) === String(req.userId)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account from the admin panel.',
      });
    }

    const targetExists = await User.findById(userId).select('_id');
    if (!targetExists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    invalidateUserSession(userId, { reason: 'account_deleted' });
    await disconnectUserSockets(userId);

    const result = await deleteUserAndAllRelatedData(userId);
    if (!result.ok) {
      return res.status(404).json({ success: false, message: result.message || 'User not found' });
    }
    notifyAdmins({ reason: 'user.deleted', userId });
    res.json({ success: true, message: 'User and all related data removed.' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
