import mongoose from 'mongoose';
import { SESSION_TYPES } from '../config/constants.js';

const sessionSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    topic: { type: String, trim: true, maxlength: 80, default: '' },
    type: { type: String, enum: SESSION_TYPES, default: 'talk' },
    location: { type: String, required: true, trim: true, maxlength: 80 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    speakers: [
      {
        name: { type: String, required: true, trim: true, maxlength: 80 },
        title: { type: String, trim: true, maxlength: 80, default: '' },
        company: { type: String, trim: true, maxlength: 80, default: '' },
        bio: { type: String, trim: true, maxlength: 500, default: '' },
      },
    ],
    capacity: { type: Number, min: 0, default: 0 }, // 0 = unlimited
    registeredCount: { type: Number, default: 0, min: 0 },
    bookmarkCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

sessionSchema.pre('validate', function check() {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate('endTime', 'End time must be after the start time');
  }
});
sessionSchema.index({ expo: 1, startTime: 1 });
sessionSchema.index({ expo: 1, location: 1, startTime: 1 });

export const Session = mongoose.model('Session', sessionSchema);
