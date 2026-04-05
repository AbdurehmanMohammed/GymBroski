import mongoose from 'mongoose';

const workoutSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  workoutName: {
    type: String,
    required: true,
    trim: true
  },
  workoutId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkoutSplit',
    default: null
  },
  dateStr: {
    type: String,
    required: true
  },
  dateISO: {
    type: String,
    required: true
  },
  durationSec: {
    type: Number,
    required: true,
    default: 0
  },
  totalVolume: {
    type: Number,
    default: 0
  },
  /** Same total as seen in the finish summary (lb-reps when all lb, else kg). totalVolume stays kg for rankings/APIs. */
  volumeDisplay: { type: Number },
  volumeDisplayUnit: { type: String },
  volumeIsMixed: { type: Boolean },
  exerciseBreakdown: [{
    name: String,
    setsCount: Number,
    bestSet: String,
    durationSec: Number,
    /** Per-set log from last save — used to show "Last session" in the active workout UI */
    sets: [{
      weight: { type: Number, default: 0 },
      reps: { type: String, default: '' }
    }]
  }],
  prs: [{
    exerciseName: String,
    weight: Number,
    reps: Number,
    bestSet: String
  }]
}, { timestamps: true });

// Index for fast lookups by user
workoutSessionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('WorkoutSession', workoutSessionSchema);
