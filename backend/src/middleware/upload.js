import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { saveLocally, uploadToCloudinary, useCloudinary } from '../services/storage.service.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMAGE_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
const DOC_TYPES = { 'application/pdf': '.pdf', ...IMAGE_TYPES };
const MAX_SIZE = 5 * 1024 * 1024;

// Magic-byte signatures: we never trust the client-supplied mimetype alone.
const SIGNATURES = {
  '.png': [[0x89, 0x50, 0x4e, 0x47]],
  '.jpg': [[0xff, 0xd8, 0xff]],
  '.webp': [[0x52, 0x49, 0x46, 0x46]],
  '.gif': [[0x47, 0x49, 0x46, 0x38]],
  '.pdf': [[0x25, 0x50, 0x44, 0x46]],
};

// Files are buffered in memory (max 5 MB, one per request), validated, then sent to Cloudinary or disk.
const build = (allowed) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE, files: 1 },
    fileFilter: (_req, file, cb) => (allowed[file.mimetype] ? cb(null, true) : cb(ApiError.badRequest('Unsupported file type'))),
  }).single('file');

const wrap = (allowed, handler) => (req, res, next) =>
  handler(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return next(ApiError.badRequest('No file uploaded (field name must be "file")'));
    const ext = allowed[req.file.mimetype];
    if (!SIGNATURES[ext]?.some((sig) => sig.every((b, i) => req.file.buffer[i] === b))) {
      return next(ApiError.badRequest('File content does not match its type'));
    }
    try {
      req.file.stored = useCloudinary ? await uploadToCloudinary(req.file) : await saveLocally(req.file, UPLOAD_DIR, ext);
      next();
    } catch (e) {
      logger.error('File storage failed', e);
      next(new ApiError(502, 'File storage is temporarily unavailable. Please try again.'));
    }
  });

export const uploadImage = wrap(IMAGE_TYPES, build(IMAGE_TYPES));
export const uploadDocument = wrap(DOC_TYPES, build(DOC_TYPES));
