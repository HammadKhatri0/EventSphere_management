import mongoose from 'mongoose';
import { TICKET_STATUS, TICKET_PRIORITY } from '../config/constants.js';

const schema = new mongoose.Schema(
  {
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo' },
    subject: { type: String, required: true, trim: true, maxlength: 140 },
    category: { type: String, enum: ['booth', 'billing', 'technical', 'schedule', 'other'], default: 'other' },
    priority: { type: String, enum: TICKET_PRIORITY, default: 'medium' },
    status: { type: String, enum: TICKET_STATUS, default: 'open' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    messages: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        body: { type: String, required: true, trim: true, maxlength: 3000 },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
schema.index({ exhibitor: 1, updatedAt: -1 });
schema.index({ status: 1, updatedAt: -1 });

export const Ticket = mongoose.model('Ticket', schema);
