import mongoose from 'mongoose';

const WorkoutSplitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  copiedFrom: {
    type: String,
    default: null
  },
  exercises: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    muscleGroup: {
      type: String,
      enum: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Other'],
      default: 'Other'
    },
    sets: {
      type: Number,
      default: 3
    },
    reps: {
      type: String,
      default: '10'
    },
    weight: {
      type: String,
      default: 'Bodyweight'
    },
    videoUrl: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  lastPerformed: {
    type: Date,
    default: null
  }
}, { 
  timestamps: true 
});

export default mongoose.model('WorkoutSplit', WorkoutSplitSchema);