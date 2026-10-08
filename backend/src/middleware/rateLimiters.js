import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit: env.isTest ? 10000 : limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message },
  });

// Broad safety net for the whole API (per IP)
export const apiLimiter = make(10 * 60 * 1000, 1500, 'Too many requests, please slow down.');
// Credential endpoints: brute force / enumeration protection
export const authLimiter = make(15 * 60 * 1000, 30, 'Too many attempts, please try again in 15 minutes.');
export const strictLimiter = make(60 * 60 * 1000, 10, 'Too many requests, please try again later.');
// Writes that create content (messages, uploads, inquiries)
export const writeLimiter = make(60 * 1000, 60, 'You are doing that too often, please wait a moment.');
