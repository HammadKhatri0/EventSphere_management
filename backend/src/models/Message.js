import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);
schema.index({ conversation: 1, createdAt: 1 });

export const Message = mongoose.model('Message', schema);
