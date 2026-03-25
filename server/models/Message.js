import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  }
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: -1 });

// TTL: auto-delete messages after retention period to save MongoDB space
const retentionDays = parseInt(process.env.MESSAGE_RETENTION_DAYS || '90', 10);
messageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: retentionDays * 24 * 60 * 60 }
);

export default mongoose.model('Message', messageSchema);
