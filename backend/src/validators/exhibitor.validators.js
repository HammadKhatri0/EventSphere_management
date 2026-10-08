import { z } from 'zod';
import { CATEGORIES, APPLICATION_STATUS, INQUIRY_TYPES, INQUIRY_STATUS, TICKET_STATUS, TICKET_PRIORITY, FEEDBACK_TYPES, FEEDBACK_STATUS } from '../config/constants.js';
import { reqStr, optStr, email, objectId, uploadUrl, clearableUpload, clearable, urlStr, dateStr, pageQuery } from './common.js';

export const profile = z.object({
  companyName: reqStr(120),
  tagline: optStr(140),
  description: optStr(3000),
  logo: clearableUpload,
  website: clearable(urlStr),
  categories: z.array(z.string().trim().max(60)).max(8).optional(),
  contact: z.object({ email: clearable(email), phone: optStr(30), address: optStr(200) }).optional(),
  products: z.array(z.object({ name: reqStr(100), description: optStr(500), image: clearableUpload })).max(50).optional(),
  documents: z.array(z.object({ name: optStr(120), url: uploadUrl })).max(20).optional(),
  staff: z.array(z.object({ name: reqStr(80), role: optStr(80), email: email.optional().or(z.literal('').transform(() => undefined)), phone: optStr(30) })).max(30).optional(),
});

export const directory = z.object({
  ...pageQuery,
  expo: objectId.optional(),
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  product: z.string().trim().max(100).optional(),
  sort: z.enum(['name', 'recent']).optional(),
});
export const neighbors = z.object({ expo: objectId, scope: z.enum(['neighbors', 'all']).optional() });

export const apply = z.object({
  expoId: objectId,
  productsServices: optStr(1500),
  message: optStr(1500),
  documents: z.array(z.object({ name: optStr(120), url: uploadUrl })).max(10).optional(),
  preferredBoothSize: z.enum(['small', 'medium', 'large', 'any']).optional(),
});
export const listApplications = z.object({
  ...pageQuery,
  expo: objectId.optional(),
  status: z.enum(APPLICATION_STATUS).optional(),
  q: z.string().trim().max(100).optional(),
});
export const reviewApplication = z
  .object({ status: z.enum(['approved', 'rejected']), reason: optStr(500) })
  .refine((d) => d.status !== 'rejected' || d.reason, { path: ['reason'], message: 'Please give a reason for rejecting' });

// ---- Attendee <-> exhibitor inquiries
export const createInquiry = z
  .object({
    expoId: objectId,
    exhibitorId: objectId,
    type: z.enum(INQUIRY_TYPES).default('inquiry'),
    subject: reqStr(140),
    message: reqStr(2000),
    appointmentAt: dateStr.optional(),
  })
  .refine((d) => d.type !== 'appointment' || (d.appointmentAt && d.appointmentAt > new Date()), { path: ['appointmentAt'], message: 'Choose a future date and time for the appointment' });
export const inquiryStatus = z.object({ status: z.enum(INQUIRY_STATUS.filter((s) => s !== 'pending')) });
export const messageBody = z.object({ body: reqStr(2000) });

// ---- Support tickets
export const createTicket = z.object({
  subject: reqStr(140),
  message: reqStr(3000),
  category: z.enum(['booth', 'billing', 'technical', 'schedule', 'other']).default('other'),
  priority: z.enum(TICKET_PRIORITY).default('medium'),
  expoId: objectId.optional(),
});
export const ticketMessage = z.object({ body: reqStr(3000) });
export const updateTicket = z.object({
  status: z.enum(TICKET_STATUS).optional(),
  priority: z.enum(TICKET_PRIORITY).optional(),
  assignedTo: objectId.nullable().optional(),
});
export const listTickets = z.object({ ...pageQuery, status: z.enum(TICKET_STATUS).optional(), q: z.string().trim().max(100).optional() });

// ---- B2B messaging
export const startConversation = z.object({ userId: objectId });

// ---- Feedback
export const createFeedback = z.object({
  type: z.enum(FEEDBACK_TYPES).default('suggestion'),
  message: reqStr(2000),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});
export const updateFeedback = z.object({ status: z.enum(FEEDBACK_STATUS) });
export const listFeedback = z.object({ ...pageQuery, status: z.enum(FEEDBACK_STATUS).optional(), type: z.enum(FEEDBACK_TYPES).optional() });

// ---- Users (admin)
export const listUsers = z.object({
  ...pageQuery,
  q: z.string().trim().max(100).optional(),
  role: z.enum(['admin', 'exhibitor', 'attendee']).optional(),
  active: z.enum(['true', 'false']).optional(),
});
export const updateUser = z.object({ isActive: z.boolean().optional(), role: z.enum(['admin', 'exhibitor', 'attendee']).optional() });
export const categories = CATEGORIES;
