import mongoose from 'mongoose';

const personalRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exerciseName: {
    type: String,
    required: true,
    trim: true
  },
  weight: {
    type: Number,
    required: true
  },
  reps: {
    type: Number,
    default: 1
  },
  unit: {
    type: String,
    enum: ['kg', 'lbs'],
    default: 'kg'
  },
  date: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

export default mongoose.model('PersonalRecord', personalRecordSchema);
