import { z } from 'zod';
import { env } from '../config/env.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParam = z.object({ id: objectId });

export const str = (max = 200) => z.string().trim().max(max);
export const reqStr = (max = 200) => z.string().trim().min(1, 'Required').max(max);
export const optStr = (max = 200) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));
export const email = z.string().trim().toLowerCase().max(120).pipe(z.email('Enter a valid email address'));
export const dateStr = z.coerce.date({ error: 'Enter a valid date' });
export const urlStr = z.string().trim().max(300).regex(/^https?:\/\//i, 'Must start with http:// or https://');

export const password = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/\d/, 'Include a number');

export const pageQuery = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

/**
 * URL pointing to a file we stored: a local /uploads path or, when Cloudinary is enabled,
 * a delivery URL on our own Cloudinary cloud (blocks arbitrary external URLs and javascript: links).
 */
const cloudUrl = env.cloudinaryEnabled
  ? new RegExp(`^https://res\\.cloudinary\\.com/${env.CLOUD_NAME.replace(/[^\w-]/g, '')}/[\\w./%~+-]+$`)
  : null;
export const uploadUrl = z.string().max(400).refine(
  (v) => /^\/uploads\/[\w.-]+$/.test(v) || (cloudUrl && cloudUrl.test(v)),
  'Invalid file reference'
);
/** Like uploadUrl, but an empty string (or null) clears the stored value. */
export const clearableUpload = z.union([uploadUrl, z.literal('').transform(() => null), z.null()]).optional();
/** Optional text that an empty string clears. */
export const clearable = (schema) => z.union([schema, z.literal('').transform(() => null), z.null()]).optional();
