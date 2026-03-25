import mongoose from 'mongoose';

const progressPhotoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image: {
    type: String,
    required: true
  },
  label: {
    type: String,
    enum: ['before', 'after', 'progress'],
    default: 'progress'
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

export default mongoose.model('ProgressPhoto', progressPhotoSchema);
