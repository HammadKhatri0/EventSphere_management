import mongoose from 'mongoose';
import { BOOTH_STATUS, BOOTH_SIZES } from '../config/constants.js';

const boothSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 12 },
    zone: { type: String, trim: true, maxlength: 40, default: '' },
    // Position/size on the floor plan grid
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
    w: { type: Number, default: 2, min: 1, max: 20 },
    h: { type: Number, default: 2, min: 1, max: 20 },
    size: { type: String, enum: BOOTH_SIZES, default: 'small' },
    price: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: BOOTH_STATUS, default: 'available' },
    // The exhibitor user who reserved / owns the booth
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
    reservedAt: Date,
    showcase: {
      tagline: { type: String, trim: true, maxlength: 140, default: '' },
      description: { type: String, trim: true, maxlength: 1000, default: '' },
      products: [{ type: String, trim: true, maxlength: 80 }],
    },
  },
  { timestamps: true }
);

boothSchema.index({ expo: 1, code: 1 }, { unique: true });
boothSchema.index({ expo: 1, status: 1 });
boothSchema.index({ exhibitor: 1 });

export const Booth = mongoose.model('Booth', boothSchema);
