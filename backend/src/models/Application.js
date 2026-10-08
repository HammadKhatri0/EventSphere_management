import mongoose from 'mongoose';
import { APPLICATION_STATUS } from '../config/constants.js';

const applicationSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    profile: { type: mongoose.Schema.Types.ObjectId, ref: 'ExhibitorProfile', required: true },
    productsServices: { type: String, trim: true, maxlength: 1500, default: '' },
    message: { type: String, trim: true, maxlength: 1500, default: '' },
    documents: [{ name: String, url: String }],
    preferredBoothSize: { type: String, enum: ['small', 'medium', 'large', 'any'], default: 'any' },
    status: { type: String, enum: APPLICATION_STATUS, default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectionReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

applicationSchema.index({ expo: 1, exhibitor: 1 }, { unique: true });
applicationSchema.index({ expo: 1, status: 1, createdAt: -1 });

export const Application = mongoose.model('Application', applicationSchema);
