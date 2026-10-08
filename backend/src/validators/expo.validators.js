import { z } from 'zod';
import { EXPO_STATUS, BOOTH_SIZES, BOOTH_STATUS, SESSION_TYPES, REMINDER_OPTIONS } from '../config/constants.js';
import { reqStr, optStr, dateStr, objectId, clearableUpload, pageQuery } from './common.js';

const location = z.object({
  venue: reqStr(140),
  address: optStr(200),
  city: optStr(80),
  country: optStr(80),
});

const expoBase = z.object({
  title: reqStr(140),
  description: optStr(4000),
  theme: optStr(120),
  startDate: dateStr,
  endDate: dateStr,
  location,
  banner: clearableUpload,
  categories: z.array(reqStr(60)).max(15).optional(),
  status: z.enum(EXPO_STATUS).optional(),
  featured: z.boolean().optional(),
  capacity: z.coerce.number().int().min(0).max(1_000_000).optional(),
  floorPlan: z.object({ cols: z.coerce.number().int().min(4).max(100), rows: z.coerce.number().int().min(4).max(100) }).optional(),
});

export const createExpo = expoBase.refine((d) => d.endDate >= d.startDate, { path: ['endDate'], message: 'End date must be on or after the start date' });
export const updateExpo = expoBase.partial();

export const listExpos = z.object({
  ...pageQuery,
  q: z.string().trim().max(100).optional(),
  status: z.enum(EXPO_STATUS).optional(),
  upcoming: z.enum(['true', 'false']).optional(),
  featured: z.enum(['true', 'false']).optional(),
  mine: z.enum(['true', 'false']).optional(),
});

// ---- Booths
const boothFields = {
  code: reqStr(12),
  zone: optStr(40),
  x: z.coerce.number().int().min(0).max(100),
  y: z.coerce.number().int().min(0).max(100),
  w: z.coerce.number().int().min(1).max(20).optional(),
  h: z.coerce.number().int().min(1).max(20).optional(),
  size: z.enum(BOOTH_SIZES).optional(),
  price: z.coerce.number().min(0).max(10_000_000).optional(),
};
export const createBooth = z.object(boothFields);
export const updateBooth = z.object({ ...boothFields, status: z.enum(BOOTH_STATUS) }).partial();
export const bulkBooths = z.object({
  rows: z.coerce.number().int().min(1).max(30),
  cols: z.coerce.number().int().min(1).max(30),
  startX: z.coerce.number().int().min(0).max(100).default(1),
  startY: z.coerce.number().int().min(0).max(100).default(1),
  w: z.coerce.number().int().min(1).max(10).default(2),
  h: z.coerce.number().int().min(1).max(10).default(2),
  gapX: z.coerce.number().int().min(0).max(10).default(1),
  gapY: z.coerce.number().int().min(0).max(10).default(1),
  prefix: reqStr(4).default('A'),
  size: z.enum(BOOTH_SIZES).default('small'),
  price: z.coerce.number().min(0).default(0),
  zone: optStr(40),
});
export const assignBooth = z.object({ exhibitorId: objectId });
export const showcase = z.object({
  tagline: optStr(140),
  description: optStr(1000),
  products: z.array(reqStr(80)).max(20).optional(),
});

// ---- Sessions
const speaker = z.object({ name: reqStr(80), title: optStr(80), company: optStr(80), bio: optStr(500) });
const sessionBase = z.object({
  title: reqStr(140),
  description: optStr(2000),
  topic: optStr(80),
  type: z.enum(SESSION_TYPES).optional(),
  location: reqStr(80),
  startTime: dateStr,
  endTime: dateStr,
  speakers: z.array(speaker).max(10).optional(),
  capacity: z.coerce.number().int().min(0).max(100000).optional(),
});
export const createSession = sessionBase.refine((d) => d.endTime > d.startTime, { path: ['endTime'], message: 'End time must be after the start time' });
export const updateSession = sessionBase.partial();
export const listSessions = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(SESSION_TYPES).optional(),
  topic: z.string().trim().max(80).optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export const reminder = z.object({
  reminderMinutes: z.coerce.number().refine((n) => REMINDER_OPTIONS.includes(n), 'Unsupported reminder').optional(),
});
