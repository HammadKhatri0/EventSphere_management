import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

if (env.cloudinaryEnabled) {
  cloudinary.config({ cloud_name: env.CLOUD_NAME, api_key: env.CLOUD_API_KEY, api_secret: env.CLOUD_API_SECRET, secure: true });
  logger.info('File storage: Cloudinary');
} else {
  logger.info('File storage: local disk (set CLOUD_NAME / CLOUD_API_KEY / CLOUD_API_SECRET to use Cloudinary)');
}

export const useCloudinary = env.cloudinaryEnabled;

/** Uploads an in-memory file to Cloudinary and resolves with its delivery URL. */
export function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'eventsphere', public_id: crypto.randomBytes(12).toString('hex'), resource_type: 'auto', overwrite: false },
      (err, result) => (err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id })),
    );
    stream.end(file.buffer);
  });
}

/** Persists an in-memory file to local disk (fallback when Cloudinary is not configured). */
export async function saveLocally(file, dir, ext) {
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  await fs.promises.writeFile(path.join(dir, name), file.buffer, { flag: 'wx' });
  return { url: `/uploads/${name}` };
}

export const destroyCloudinaryAsset = (publicId, resourceType = 'image') => cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
