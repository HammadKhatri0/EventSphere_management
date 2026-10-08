import { asyncHandler } from '../utils/asyncHandler.js';

export const uploaded = asyncHandler(async (req, res) => {
  res.status(201).json({
    success: true,
    data: { url: req.file.stored.url, name: req.file.originalname.slice(0, 120), size: req.file.size },
  });
});
