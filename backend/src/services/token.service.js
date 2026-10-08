import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { RefreshToken } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

export const COOKIE_NAME = 'es_refresh';
const REUSE_GRACE_MS = 10_000;

/** Keyed hash (HMAC-SHA256): a leaked database alone cannot be used to forge or look up tokens. */
export const hashToken = (v) => crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(v).digest('hex');

export const signAccessToken = (user) =>
  jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, { subject: String(user._id), expiresIn: env.ACCESS_TOKEN_TTL, algorithm: 'HS256' });

export const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
});

async function issueRefreshToken(userId, req, family = crypto.randomUUID()) {
  const raw = crypto.randomBytes(48).toString('base64url');
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(raw),
    family,
    userAgent: req.headers['user-agent']?.slice(0, 200),
    ip: req.ip,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000),
  });
  return raw;
}

/** Issues access token + sets the httpOnly refresh cookie. */
export async function startSession(user, req, res, family) {
  const refresh = await issueRefreshToken(user._id, req, family);
  res.cookie(COOKIE_NAME, refresh, cookieOptions());
  return signAccessToken(user);
}

/** Rotates the refresh token. Re-use of an already rotated token revokes the whole token family. */
export async function rotateSession(req, res) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) throw ApiError.unauthorized('No session');
  const stored = await RefreshToken.findOne({ tokenHash: hashToken(raw) });
  if (!stored) { clearSessionCookie(res); throw ApiError.unauthorized('Session expired'); }

  if (stored.revokedAt) {
    if (Date.now() - stored.revokedAt.getTime() > REUSE_GRACE_MS) {
      await RefreshToken.deleteMany({ family: stored.family }); // probable token theft
    }
    clearSessionCookie(res);
    throw ApiError.unauthorized('Session expired');
  }
  stored.revokedAt = new Date();
  await stored.save();
  return { userId: stored.user, family: stored.family };
}

export async function endSession(req, res) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (raw) {
    const stored = await RefreshToken.findOne({ tokenHash: hashToken(raw) });
    if (stored) await RefreshToken.deleteMany({ family: stored.family });
  }
  clearSessionCookie(res);
}

export const revokeAllForUser = (userId) => RefreshToken.deleteMany({ user: userId });

export const clearSessionCookie = (res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
};
