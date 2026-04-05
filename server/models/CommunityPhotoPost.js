import mongoose from 'mongoose';

const communityPhotoCommentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 280,
    },
  },
  { timestamps: true }
);

const communityPhotoPostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    image: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      trim: true,
      default: '',
      maxlength: 240,
    },
    workoutName: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    durationSec: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalVolume: {
      type: Number,
      min: 0,
      default: 0,
    },
    recordsCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    rankSnapshot: {
      type: Number,
      default: null,
      validate: {
        validator(v) {
          return v == null || v >= 1;
        },
      },
    },
    rankTotalUsers: {
      type: Number,
      default: null,
      validate: {
        validator(v) {
          return v == null || v >= 1;
        },
      },
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [communityPhotoCommentSchema],
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('CommunityPhotoPost', communityPhotoPostSchema);
