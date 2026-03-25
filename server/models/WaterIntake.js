import mongoose from 'mongoose';

const waterIntakeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  unit: {
    type: String,
    enum: ['ml', 'oz'],
    default: 'ml'
  },
  date: {
    type: Date,
    default: () => new Date(new Date().setHours(0, 0, 0, 0))
  }
}, { timestamps: true });

export default mongoose.model('WaterIntake', waterIntakeSchema);
