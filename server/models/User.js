import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  points: {
    type: Number,
    default: 0
  },
  /** Email reminder for “today’s” scheduled workout (see jobs/workoutReminders.js) */
  emailWorkoutReminders: {
    type: Boolean,
    default: true
  },
  /** Per weekday: which saved workout (0=Sun … 6=Sat). Omitted days = rest. */
  workoutSchedule: {
    type: [
      {
        day: { type: Number, min: 0, max: 6 },
        workoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutSplit', default: null }
      }
    ],
    default: []
  },
  workoutReminderHour: { type: Number, min: 0, max: 23, default: 8 },
  workoutReminderMinute: { type: Number, min: 0, max: 59, default: 0 },
  timezone: { type: String, default: 'UTC', trim: true },
  /** YYYY-MM-DD in user TZ — last reminder sent */
  lastWorkoutReminderSentOn: { type: String, default: '' },
  /** Email when someone sends a private/group chat message */
  emailChatNotifications: { type: Boolean, default: true },
  lastChatEmailNotificationAt: { type: Date, default: null }
}, {
  timestamps: true
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
