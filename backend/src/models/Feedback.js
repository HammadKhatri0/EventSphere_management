import mongoose from 'mongoose';
import { FEEDBACK_TYPES, FEEDBACK_STATUS } from '../config/constants.js';

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: FEEDBACK_TYPES, default: 'suggestion' },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    rating: { type: Number, min: 1, max: 5 },
    status: { type: String, enum: FEEDBACK_STATUS, default: 'new' },
  },
  { timestamps: true }
);
schema.index({ status: 1, createdAt: -1 });

export const Feedback = mongoose.model('Feedback', schema);
