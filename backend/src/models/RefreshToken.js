import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    revokedAt: Date, // set when rotated; re-use of a revoked token revokes the entire family
    userAgent: String,
    ip: String,
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL: auto-removed after expiry
  },
  { timestamps: true }
);

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
