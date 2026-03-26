import mongoose from 'mongoose';
import User from '../models/User.js';
import WorkoutSplit from '../models/WorkoutSplit.js';
import WorkoutSession from '../models/WorkoutSession.js';
import PersonalRecord from '../models/PersonalRecord.js';
import WaterIntake from '../models/WaterIntake.js';
import BodyWeight from '../models/BodyWeight.js';
import ProgressPhoto from '../models/ProgressPhoto.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

/**
 * Removes a user and all app data tied to them (workouts, sessions, PRs, tracking, photos,
 * chat messages, private chats, group membership). Challenge points live on User — deleted with the user.
 * Safe to call from the API or a maintenance script after mongoose.connect().
 */
export async function deleteUserAndAllRelatedData(userId) {
  const uid = new mongoose.Types.ObjectId(String(userId));

  const user = await User.findById(uid).select('_id');
  if (!user) {
    return { ok: false, message: 'User not found' };
  }

  const privateConvs = await Conversation.find({
    type: 'private',
    participants: uid,
  })
    .select('_id')
    .lean();
  const privateIds = privateConvs.map((c) => c._id);
  if (privateIds.length) {
    await Message.deleteMany({ conversationId: { $in: privateIds } });
    await Conversation.deleteMany({ _id: { $in: privateIds } });
  }

  const groupConvs = await Conversation.find({ type: 'group', participants: uid });
  for (const conv of groupConvs) {
    const remaining = conv.participants.filter((p) => p.toString() !== uid.toString());
    const lra = (conv.lastReadAt || []).filter((r) => r.userId?.toString() !== uid.toString());
    if (remaining.length < 2) {
      await Message.deleteMany({ conversationId: conv._id });
      await Conversation.deleteOne({ _id: conv._id });
    } else {
      const createdBy =
        conv.createdBy?.toString() === uid.toString() ? remaining[0] : conv.createdBy;
      await Conversation.updateOne(
        { _id: conv._id },
        { $set: { participants: remaining, lastReadAt: lra, createdBy } }
      );
    }
  }

  await Message.deleteMany({ senderId: uid });

  await Conversation.updateMany(
    { type: 'public', participants: uid },
    { $pull: { participants: uid, lastReadAt: { userId: uid } } }
  );

  await WorkoutSession.deleteMany({ userId: uid });
  await WorkoutSplit.deleteMany({ userId: uid });
  await PersonalRecord.deleteMany({ userId: uid });
  await WaterIntake.deleteMany({ userId: uid });
  await BodyWeight.deleteMany({ userId: uid });
  await ProgressPhoto.deleteMany({ userId: uid });

  await User.deleteOne({ _id: uid });

  return { ok: true };
}
