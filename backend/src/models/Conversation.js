import mongoose from 'mongoose';

// Direct B2B conversation between exactly two users (exhibitor <-> exhibitor).
const schema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: (v) => v.length === 2,
    },
    pairKey: { type: String, required: true, unique: true }, // sorted "idA:idB" guarantees one thread per pair
    lastMessage: { type: String, default: '' },
    lastAt: { type: Date, default: Date.now },
    unread: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);
schema.index({ participants: 1, lastAt: -1 });

export const Conversation = mongoose.model('Conversation', schema);
