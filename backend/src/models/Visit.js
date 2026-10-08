import mongoose from 'mongoose';

// Lightweight engagement event used for booth traffic / heatmap analytics.
const schema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
    type: { type: String, enum: ['booth', 'exhibitor', 'expo'], required: true },
    booth: { type: mongoose.Schema.Types.ObjectId, ref: 'Booth' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

schema.index({ expo: 1, type: 1, at: 1 });
schema.index({ booth: 1 });
schema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }); // keep one year

export const Visit = mongoose.model('Visit', schema);
