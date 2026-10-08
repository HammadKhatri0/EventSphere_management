import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
  },
  { timestamps: true }
);
schema.index({ user: 1, expo: 1 }, { unique: true });
schema.index({ expo: 1, createdAt: 1 });

export const ExpoRegistration = mongoose.model('ExpoRegistration', schema);
