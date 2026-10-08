import mongoose from 'mongoose';
import { EXPO_STATUS } from '../config/constants.js';

const expoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 4000, default: '' },
    theme: { type: String, trim: true, maxlength: 120, default: '' },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    location: {
      venue: { type: String, trim: true, maxlength: 140, required: true },
      address: { type: String, trim: true, maxlength: 200, default: '' },
      city: { type: String, trim: true, maxlength: 80, default: '' },
      country: { type: String, trim: true, maxlength: 80, default: '' },
    },
    banner: String,
    categories: [{ type: String, trim: true, maxlength: 60 }],
    status: { type: String, enum: EXPO_STATUS, default: 'draft', index: true },
    featured: { type: Boolean, default: false },
    capacity: { type: Number, min: 0, default: 0 },
    // Floor plan canvas size in grid units (1 unit = 1 "cell")
    floorPlan: {
      cols: { type: Number, min: 4, max: 100, default: 24 },
      rows: { type: Number, min: 4, max: 100, default: 14 },
    },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

expoSchema.pre('validate', function check() {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be on or after the start date');
  }
});
expoSchema.index({ title: 'text', description: 'text', theme: 'text' });
expoSchema.index({ status: 1, startDate: 1 });

export const Expo = mongoose.model('Expo', expoSchema);
