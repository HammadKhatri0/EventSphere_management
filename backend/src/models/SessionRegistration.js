import mongoose from 'mongoose';

// One document per (user, session): either a bookmark or a confirmed registration.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
    kind: { type: String, enum: ['bookmark', 'registered'], required: true },
    reminderMinutes: { type: Number, default: 15 },
    remindAt: { type: Date, default: null },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

schema.index({ user: 1, session: 1 }, { unique: true });
schema.index({ expo: 1, kind: 1 });
schema.index({ remindAt: 1, reminderSent: 1 });

export const SessionRegistration = mongoose.model('SessionRegistration', schema);
