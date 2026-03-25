import express from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { notifyChatMessageByEmail } from '../services/chatEmail.js';
const router = express.Router();

router.use(authenticateToken);

// Get or create the public (community) conversation
const getPublicConversation = async () => {
  let conv = await Conversation.findOne({ type: 'public' });
  if (!conv) {
    conv = new Conversation({ type: 'public', participants: [] });
    await conv.save();
  }
  return conv;
};

// GET public chat messages
router.get('/public/messages', async (req, res) => {
  try {
    const conv = await getPublicConversation();
    const messages = await Message.find({ conversationId: conv._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('senderId', 'name profilePhoto')
      .populate({ path: 'replyTo', select: 'content createdAt', populate: { path: 'senderId', select: 'name' } })
      .lean();

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get public messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

// POST public chat message
router.post('/public/messages', async (req, res) => {
  try {
    const { content, replyTo } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content required' });
    }

    const conv = await getPublicConversation();
    const msgData = {
      conversationId: conv._id,
      senderId: req.userId,
      content: content.trim().slice(0, 2000)
    };
    if (replyTo) {
      const parent = await Message.findOne({ _id: replyTo, conversationId: conv._id });
      if (parent) msgData.replyTo = parent._id;
    }
    const msg = new Message(msgData);
    await msg.save();
    await conv.updateOne({ lastMessageAt: new Date() });

    const populated = await Message.findById(msg._id)
      .populate('senderId', 'name profilePhoto')
      .populate({ path: 'replyTo', select: 'content createdAt', populate: { path: 'senderId', select: 'name' } })
      .lean();

    res.status(201).json(populated);
  } catch (error) {
    console.error('Post public message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// PATCH public message (own messages only)
router.patch('/public/messages/:id', async (req, res) => {
  try {
    const msg = await Message.findOne({
      _id: req.params.id,
      senderId: req.userId
    });
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    const conv = await Conversation.findById(msg.conversationId);
    if (!conv || conv.type !== 'public') return res.status(404).json({ success: false, message: 'Message not found' });

    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ success: false, message: 'Content required' });

    msg.content = content.trim().slice(0, 2000);
    await msg.save();

    const populated = await Message.findById(msg._id)
      .populate('senderId', 'name profilePhoto')
      .populate({ path: 'replyTo', select: 'content createdAt', populate: { path: 'senderId', select: 'name' } })
      .lean();
    res.json(populated);
  } catch (error) {
    console.error('Update public message error:', error);
    res.status(500).json({ success: false, message: 'Failed to update message' });
  }
});

// DELETE public message (own messages only)
router.delete('/public/messages/:id', async (req, res) => {
  try {
    const msg = await Message.findOne({
      _id: req.params.id,
      senderId: req.userId
    });

    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const conv = await Conversation.findById(msg.conversationId);
    if (!conv || conv.type !== 'public') {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    await Message.deleteOne({ _id: msg._id });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete public message error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
});

// GET my private + group conversations (with unread count)
router.get('/conversations', async (req, res) => {
  try {
    const convs = await Conversation.find({
      type: { $in: ['private', 'group'] },
      participants: req.userId
    })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'name profilePhoto')
      .populate('createdBy', 'name')
      .lean();

    const list = await Promise.all(convs.map(async (c) => {
      const myRead = c.lastReadAt?.find((r) => r.userId?.toString() === req.userId.toString());
      const lastRead = myRead?.at ? new Date(myRead.at) : null;

      const unreadCount = await Message.countDocuments({
        conversationId: c._id,
        senderId: { $ne: req.userId },
        ...(lastRead ? { createdAt: { $gt: lastRead } } : {})
      });

      if (c.type === 'private') {
        const other = c.participants.find((p) => p._id.toString() !== req.userId.toString());
        return {
          _id: c._id,
          type: 'private',
          otherUser: other,
          lastMessageAt: c.lastMessageAt,
          unreadCount
        };
      }
      return {
        _id: c._id,
        type: 'group',
        name: c.name || 'Group chat',
        participants: c.participants,
        createdBy: c.createdBy,
        lastMessageAt: c.lastMessageAt,
        unreadCount
      };
    }));

    res.json(list);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
  }
});

// GET or create private conversation with a user
router.post('/conversations', async (req, res) => {
  try {
    const { otherUserId } = req.body;
    if (!otherUserId || otherUserId === req.userId) {
      return res.status(400).json({ success: false, message: 'Valid other user ID required' });
    }

    const participants = [req.userId, otherUserId].sort();
    let conv = await Conversation.findOne({
      type: 'private',
      participants: { $all: participants, $size: 2 }
    });

    if (!conv) {
      conv = new Conversation({ type: 'private', participants });
      await conv.save();
    }

    const populated = await Conversation.findById(conv._id)
      .populate('participants', 'name profilePhoto')
      .lean();

    res.json(populated);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create conversation' });
  }
});

// POST create group conversation
router.post('/conversations/group', async (req, res) => {
  try {
    const { name, participantIds } = req.body;
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one participant required' });
    }

    const uniqueIds = [...new Set([req.userId.toString(), ...participantIds.map(String)])];
    const participants = uniqueIds;

    const conv = new Conversation({
      type: 'group',
      name: (name || '').trim() || 'Group chat',
      createdBy: req.userId,
      participants
    });
    await conv.save();

    const populated = await Conversation.findById(conv._id)
      .populate('participants', 'name profilePhoto')
      .populate('createdBy', 'name')
      .lean();

    res.status(201).json(populated);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ success: false, message: 'Failed to create group' });
  }
});

// POST add user to group (creator only)
router.post('/conversations/:id/add', async (req, res) => {
  try {
    const conv = await Conversation.findOne({
      _id: req.params.id,
      type: 'group',
      participants: req.userId,
      createdBy: req.userId
    });
    if (!conv) {
      return res.status(403).json({ success: false, message: 'Only the group creator can add members' });
    }

    const { userId: targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const targetStr = targetUserId.toString();
    const participants = conv.participants.map((p) => p.toString());
    if (participants.includes(targetStr)) {
      return res.status(400).json({ success: false, message: 'User already in group' });
    }

    participants.push(targetStr);
    await Conversation.updateOne({ _id: conv._id }, { $set: { participants } });

    const populated = await Conversation.findById(conv._id)
      .populate('participants', 'name profilePhoto')
      .populate('createdBy', 'name')
      .lean();

    res.json(populated);
  } catch (error) {
    console.error('Add to group error:', error);
    res.status(500).json({ success: false, message: 'Failed to add member' });
  }
});

// POST kick user from group (creator only)
router.post('/conversations/:id/kick', async (req, res) => {
  try {
    const conv = await Conversation.findOne({
      _id: req.params.id,
      type: 'group',
      participants: req.userId,
      createdBy: req.userId
    });
    if (!conv) {
      return res.status(403).json({ success: false, message: 'Only the group creator can kick members' });
    }

    const { userId: targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const targetStr = targetUserId.toString();
    if (targetStr === req.userId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot kick yourself' });
    }

    const participants = conv.participants.map((p) => p.toString());
    if (!participants.includes(targetStr)) {
      return res.status(404).json({ success: false, message: 'User not in group' });
    }

    const updated = conv.participants.filter((p) => p.toString() !== targetStr);
    await Conversation.updateOne({ _id: conv._id }, { $set: { participants: updated } });

    const populated = await Conversation.findById(conv._id)
      .populate('participants', 'name profilePhoto')
      .populate('createdBy', 'name')
      .lean();

    res.json(populated);
  } catch (error) {
    console.error('Kick from group error:', error);
    res.status(500).json({ success: false, message: 'Failed to kick member' });
  }
});

// GET messages for a private or group conversation (also marks as read)
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const conv = await Conversation.findOne({
      _id: req.params.id,
      type: { $in: ['private', 'group'] },
      participants: req.userId
    });

    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Mark as read
    const lra = conv.lastReadAt || [];
    const existing = lra.findIndex((r) => r.userId?.toString() === req.userId.toString());
    const now = new Date();
    if (existing >= 0) {
      lra[existing].at = now;
    } else {
      lra.push({ userId: req.userId, at: now });
    }
    await Conversation.updateOne(
      { _id: conv._id },
      { $set: { lastReadAt: lra } }
    );

    const messages = await Message.find({ conversationId: conv._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('senderId', 'name profilePhoto')
      .populate({ path: 'replyTo', select: 'content createdAt', populate: { path: 'senderId', select: 'name' } })
      .lean();

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

// POST message to private or group conversation
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const conv = await Conversation.findOne({
      _id: req.params.id,
      type: { $in: ['private', 'group'] },
      participants: req.userId
    });

    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const { content, replyTo } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content required' });
    }

    const msgData = {
      conversationId: conv._id,
      senderId: req.userId,
      content: content.trim().slice(0, 2000)
    };
    if (replyTo) {
      const parent = await Message.findOne({ _id: replyTo, conversationId: conv._id });
      if (parent) msgData.replyTo = parent._id;
    }
    const msg = new Message(msgData);
    await msg.save();
    await conv.updateOne({ lastMessageAt: new Date() });

    const populated = await Message.findById(msg._id)
      .populate('senderId', 'name profilePhoto')
      .populate({ path: 'replyTo', select: 'content createdAt', populate: { path: 'senderId', select: 'name' } })
      .lean();

    const recipientIds = (conv.participants || [])
      .map((p) => p.toString())
      .filter((id) => id !== req.userId.toString());
    const senderName = populated?.senderId?.name || 'Someone';
    const conversationLabel =
      conv.type === 'group' ? (conv.name || 'Group chat') : 'Direct message';
    notifyChatMessageByEmail({
      recipientIds,
      senderName,
      preview: content.trim(),
      conversationLabel
    }).catch((e) => console.error('[chat] email notify:', e.message));

    res.status(201).json(populated);
  } catch (error) {
    console.error('Post private message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// PATCH private/group message (own messages only)
router.patch('/conversations/:id/messages/:messageId', async (req, res) => {
  try {
    const conv = await Conversation.findOne({
      _id: req.params.id,
      type: { $in: ['private', 'group'] },
      participants: req.userId
    });
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const msg = await Message.findOne({
      _id: req.params.messageId,
      conversationId: conv._id,
      senderId: req.userId
    });
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ success: false, message: 'Content required' });

    msg.content = content.trim().slice(0, 2000);
    await msg.save();

    const populated = await Message.findById(msg._id)
      .populate('senderId', 'name profilePhoto')
      .populate({ path: 'replyTo', select: 'content createdAt', populate: { path: 'senderId', select: 'name' } })
      .lean();
    res.json(populated);
  } catch (error) {
    console.error('Update private message error:', error);
    res.status(500).json({ success: false, message: 'Failed to update message' });
  }
});

// DELETE private/group message (own messages only)
router.delete('/conversations/:id/messages/:messageId', async (req, res) => {
  try {
    const userId = mongoose.Types.ObjectId.isValid(req.userId) ? req.userId : new mongoose.Types.ObjectId(req.userId);

    const conv = await Conversation.findOne({
      _id: req.params.id,
      type: { $in: ['private', 'group'] },
      participants: userId
    });

    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const msg = await Message.findOne({
      _id: req.params.messageId,
      conversationId: conv._id,
      senderId: userId
    });

    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    await Message.deleteOne({ _id: msg._id });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete private message error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
});

// DELETE private/group conversation (and its messages)
router.delete('/conversations/:id', async (req, res) => {
  try {
    const conv = await Conversation.findOne({
      _id: req.params.id,
      type: { $in: ['private', 'group'] },
      participants: req.userId
    });

    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    await Message.deleteMany({ conversationId: conv._id });
    await Conversation.deleteOne({ _id: conv._id });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete conversation' });
  }
});

// GET list of users for starting a private chat (community workout creators + others)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } })
      .select('name profilePhoto')
      .limit(50)
      .lean();

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

export default router;
