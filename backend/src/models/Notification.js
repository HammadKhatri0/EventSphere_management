import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, default: 'info' },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, maxlength: 500, default: '' },
    link: { type: String, maxlength: 200 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
schema.index({ user: 1, read: 1, createdAt: -1 });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const Notification = mongoose.model('Notification', schema);
