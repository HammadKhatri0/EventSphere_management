import mongoose from 'mongoose';
import { INQUIRY_TYPES, INQUIRY_STATUS } from '../config/constants.js';

const schema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true },
    attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: INQUIRY_TYPES, default: 'inquiry' },
    subject: { type: String, required: true, trim: true, maxlength: 140 },
    appointmentAt: Date,
    status: { type: String, enum: INQUIRY_STATUS, default: 'pending' },
    messages: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        body: { type: String, required: true, trim: true, maxlength: 2000 },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
schema.index({ attendee: 1, updatedAt: -1 });
schema.index({ exhibitor: 1, updatedAt: -1 });

export const Inquiry = mongoose.model('Inquiry', schema);
