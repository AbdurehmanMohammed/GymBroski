import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import CommunityPhotoPost from '../models/CommunityPhotoPost.js';
import User from '../models/User.js';
import { notifyCommunityPhotoByEmail } from '../services/communityPhotoEmail.js';

const router = express.Router();
router.use(authenticateToken);

const COMMUNITY_PHOTO_TTL_HOURS = 48;

/** Dedicated router (mounted at /api/community-photos) so POST never collides with progress-photos /:id routes. */
router.get('/', async (req, res) => {
  try {
    const limitRaw = Number.parseInt(String(req.query.limit || '18'), 10);
    const skipRaw = Number.parseInt(String(req.query.skip || '0'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 40) : 18;
    const skip = Number.isFinite(skipRaw) ? Math.max(skipRaw, 0) : 0;
    const posts = await CommunityPhotoPost.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name profilePhoto')
      .populate('comments.userId', 'name profilePhoto');

    const myId = String(req.userId);
    const shaped = posts.map((p) => ({
      _id: p._id,
      userId: p.userId,
      image: p.image,
      caption: p.caption || '',
      workoutName: p.workoutName || '',
      durationSec: p.durationSec || 0,
      totalVolume: p.totalVolume || 0,
      recordsCount: p.recordsCount || 0,
      rankSnapshot: p.rankSnapshot ?? null,
      rankTotalUsers: p.rankTotalUsers ?? null,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
      likesCount: Array.isArray(p.likes) ? p.likes.length : 0,
      likedByMe: Array.isArray(p.likes) ? p.likes.some((id) => String(id) === myId) : false,
      canDelete: String(p.userId?._id || p.userId) === myId,
      comments: Array.isArray(p.comments)
        ? p.comments.map((c) => ({
            _id: c._id,
            text: c.text,
            createdAt: c.createdAt,
            userId: c.userId,
          }))
        : [],
    }));

    res.json({
      items: shaped,
      hasMore: shaped.length === limit,
      nextSkip: skip + shaped.length,
    });
  } catch (e) {
    console.error('Community photos fetch error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { image, caption, workoutName, durationSec, totalVolume, recordsCount } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Image required' });
    }
    if (typeof image === 'string' && image.length > 14_500_000) {
      return res.status(400).json({
        success: false,
        message: 'Photo is too large after upload. Try a different image or retake at lower resolution.',
      });
    }

    const actor = await User.findById(req.userId).select('name points role');
    if (!actor) return res.status(404).json({ success: false, message: 'User not found' });

    let rankSnapshot = null;
    let rankTotalUsers = null;
    if ((actor.role || 'user') !== 'admin') {
      const [higherPointsCount, totalUsers] = await Promise.all([
        User.countDocuments({ role: { $ne: 'admin' }, points: { $gt: actor.points ?? 0 } }),
        User.countDocuments({ role: { $ne: 'admin' } }),
      ]);
      rankSnapshot = higherPointsCount + 1;
      rankTotalUsers = Math.max(1, totalUsers);
    }

    const expiresAt = new Date(Date.now() + COMMUNITY_PHOTO_TTL_HOURS * 60 * 60 * 1000);
    const post = new CommunityPhotoPost({
      userId: req.userId,
      image,
      caption: String(caption || '').trim(),
      workoutName: String(workoutName || '').trim(),
      durationSec: Math.max(0, Number(durationSec) || 0),
      totalVolume: Math.max(0, Number(totalVolume) || 0),
      recordsCount: Math.max(0, Number(recordsCount) || 0),
      rankSnapshot,
      rankTotalUsers,
      expiresAt,
    });
    await post.save();
    await post.populate('userId', 'name profilePhoto');

    const payload = {
      _id: post._id,
      userId: post.userId,
      image: post.image,
      caption: post.caption,
      workoutName: post.workoutName,
      durationSec: post.durationSec,
      totalVolume: post.totalVolume,
      recordsCount: post.recordsCount,
      rankSnapshot: post.rankSnapshot,
      rankTotalUsers: post.rankTotalUsers,
      createdAt: post.createdAt,
      expiresAt: post.expiresAt,
      likesCount: 0,
      likedByMe: false,
      canDelete: true,
      comments: [],
    };

    res.status(201).json(payload);
    void notifyCommunityPhotoByEmail({
      actorUserId: req.userId,
      actorName: actor.name,
      workoutName: post.workoutName || 'New photo post',
    }).catch((err) => console.error('[communityPhoto] notify (background):', err?.message || err));
  } catch (e) {
    console.error('Community photo create error:', e);
    let msg =
      e?.name === 'PayloadTooLargeError' || /entity too large|too large/i.test(String(e?.message))
        ? 'Photo is too large. Try a smaller image or retake with lower resolution.'
        : e?.message?.includes('BSON')
          ? 'Photo is too large to store. Try a smaller image.'
          : 'Server error';
    if (e?.name === 'ValidationError' && e.errors) {
      msg = Object.values(e.errors)
        .map((er) => er.message)
        .join(' ');
    } else if (process.env.NODE_ENV !== 'production' && e?.message) {
      msg = e.message;
    }
    const code = e?.name === 'PayloadTooLargeError' ? 413 : 500;
    res.status(code).json({ success: false, message: msg });
  }
});

router.post('/:id/like', async (req, res) => {
  try {
    const post = await CommunityPhotoPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    const myId = String(req.userId);
    const hasLiked = post.likes.some((id) => String(id) === myId);
    if (hasLiked) {
      post.likes = post.likes.filter((id) => String(id) !== myId);
    } else {
      post.likes.push(req.userId);
    }
    await post.save();
    res.json({
      success: true,
      likedByMe: !hasLiked,
      likesCount: post.likes.length,
    });
  } catch (e) {
    console.error('Community photo like error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Comment required' });
    if (text.length > 280) {
      return res.status(400).json({ success: false, message: 'Comment must be 280 characters or less' });
    }

    const post = await CommunityPhotoPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    post.comments.push({ userId: req.userId, text });
    await post.save();
    await post.populate('comments.userId', 'name profilePhoto');
    const newComment = post.comments[post.comments.length - 1];
    res.status(201).json({
      _id: newComment._id,
      text: newComment.text,
      createdAt: newComment.createdAt,
      userId: newComment.userId,
    });
  } catch (e) {
    console.error('Community photo comment error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const post = await CommunityPhotoPost.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found or not yours' });
    res.json({ success: true });
  } catch (e) {
    console.error('Community photo delete error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
