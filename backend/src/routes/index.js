import { Router } from 'express';
import mongoose from 'mongoose';
import { protect, optionalAuth, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, strictLimiter, writeLimiter } from '../middleware/rateLimiters.js';
import { uploadImage, uploadDocument } from '../middleware/upload.js';
import { idParam, objectId } from '../validators/common.js';
import { z } from 'zod';
import * as A from '../validators/auth.validators.js';
import * as E from '../validators/expo.validators.js';
import * as X from '../validators/exhibitor.validators.js';
import * as auth from '../controllers/auth.controller.js';
import * as expo from '../controllers/expo.controller.js';
import * as booth from '../controllers/booth.controller.js';
import * as app from '../controllers/application.controller.js';
import * as exhibitor from '../controllers/exhibitor.controller.js';
import * as session from '../controllers/session.controller.js';
import * as inquiry from '../controllers/inquiry.controller.js';
import * as ticket from '../controllers/ticket.controller.js';
import * as message from '../controllers/message.controller.js';
import * as misc from '../controllers/misc.controller.js';
import * as analytics from '../controllers/analytics.controller.js';
import { uploaded } from '../controllers/upload.controller.js';
import { CATEGORIES, SESSION_TYPES, REMINDER_OPTIONS, MAX_BOOTHS_PER_EXHIBITOR } from '../config/constants.js';

const router = Router();
const admin = [protect, authorize('admin')];
const exhibitorOnly = [protect, authorize('exhibitor')];
const attendeeOnly = [protect, authorize('attendee')];
const expoParam = z.object({ expoId: objectId });
const boothParams = z.object({ expoId: objectId, boothId: objectId });

// ---------- System ----------
router.get('/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down', uptime: Math.round(process.uptime()), time: new Date() });
});
router.get('/meta', (_req, res) => res.json({ success: true, data: { categories: CATEGORIES, sessionTypes: SESSION_TYPES, reminderOptions: REMINDER_OPTIONS, maxBoothsPerExhibitor: MAX_BOOTHS_PER_EXHIBITOR } }));

// ---------- Auth ----------
router.post('/auth/register', authLimiter, validate({ body: A.register }), auth.register);
router.post('/auth/login', authLimiter, validate({ body: A.login }), auth.login);
router.post('/auth/refresh', authLimiter, auth.refresh);
router.post('/auth/logout', auth.logout);
router.post('/auth/forgot-password', strictLimiter, validate({ body: A.forgot }), auth.forgotPassword);
router.post('/auth/reset-password', strictLimiter, validate({ body: A.reset }), auth.resetPassword);
router.get('/auth/me', protect, auth.me);
router.patch('/auth/me', protect, validate({ body: A.updateMe }), auth.updateMe);
router.patch('/auth/me/password', protect, authLimiter, validate({ body: A.changePassword }), auth.changePassword);
router.get('/auth/me/export', protect, strictLimiter, auth.exportMyData);
router.delete('/auth/me', protect, strictLimiter, validate({ body: A.deleteAccount }), auth.deleteAccount);

// ---------- Uploads ----------
router.post('/uploads/image', protect, writeLimiter, uploadImage, uploaded);
router.post('/uploads/document', protect, writeLimiter, uploadDocument, uploaded);

// ---------- Expos ----------
router.get('/expos', optionalAuth, validate({ query: E.listExpos }), expo.listExpos);
router.get('/expos/registrations/mine', ...attendeeOnly, expo.myRegistrations);
router.post('/expos', ...admin, validate({ body: E.createExpo }), expo.createExpo);
router.get('/expos/:id', optionalAuth, validate({ params: idParam }), expo.getExpo);
router.patch('/expos/:id', ...admin, validate({ params: idParam, body: E.updateExpo }), expo.updateExpo);
router.delete('/expos/:id', ...admin, validate({ params: idParam }), expo.deleteExpo);
router.post('/expos/:id/register', ...attendeeOnly, validate({ params: idParam }), expo.registerForExpo);
router.delete('/expos/:id/register', ...attendeeOnly, validate({ params: idParam }), expo.unregisterFromExpo);

// ---------- Booths / floor plan ----------
router.get('/booths/mine', ...exhibitorOnly, booth.myBooths);
router.get('/expos/:expoId/booths', optionalAuth, validate({ params: expoParam }), booth.listBooths);
router.post('/expos/:expoId/booths', ...admin, validate({ params: expoParam, body: E.createBooth }), booth.createBooth);
router.post('/expos/:expoId/booths/bulk', ...admin, validate({ params: expoParam, body: E.bulkBooths }), booth.bulkCreateBooths);
router.patch('/expos/:expoId/booths/:boothId', ...admin, validate({ params: boothParams, body: E.updateBooth }), booth.updateBooth);
router.delete('/expos/:expoId/booths/:boothId', ...admin, validate({ params: boothParams }), booth.deleteBooth);
router.post('/expos/:expoId/booths/:boothId/reserve', ...exhibitorOnly, writeLimiter, validate({ params: boothParams }), booth.reserveBooth);
router.post('/expos/:expoId/booths/:boothId/release', protect, authorize('admin', 'exhibitor'), validate({ params: boothParams }), booth.releaseBooth);
router.post('/expos/:expoId/booths/:boothId/confirm', ...admin, validate({ params: boothParams }), booth.confirmBooth);
router.post('/expos/:expoId/booths/:boothId/assign', ...admin, validate({ params: boothParams, body: E.assignBooth }), booth.assignBooth);
router.patch('/expos/:expoId/booths/:boothId/showcase', ...exhibitorOnly, validate({ params: boothParams, body: E.showcase }), booth.updateShowcase);
router.post('/expos/:expoId/booths/:boothId/visit', optionalAuth, writeLimiter, validate({ params: boothParams }), booth.recordVisit);
router.get('/expos/:expoId/approved-exhibitors', ...admin, validate({ params: expoParam }), app.approvedExhibitors);

// ---------- Sessions / schedule ----------
router.get('/expos/:expoId/sessions', optionalAuth, validate({ params: expoParam, query: E.listSessions }), session.listSessions);
router.post('/expos/:expoId/sessions', ...admin, validate({ params: expoParam, body: E.createSession }), session.createSession);
router.get('/sessions/mine', ...attendeeOnly, session.myAgenda);
router.patch('/sessions/:id', ...admin, validate({ params: idParam, body: E.updateSession }), session.updateSession);
router.delete('/sessions/:id', ...admin, validate({ params: idParam }), session.deleteSession);
router.post('/sessions/:id/bookmark', ...attendeeOnly, validate({ params: idParam, body: E.reminder }), session.bookmark);
router.post('/sessions/:id/register', ...attendeeOnly, validate({ params: idParam, body: E.reminder }), session.register);
router.post('/sessions/:id/unregister', ...attendeeOnly, validate({ params: idParam }), session.unregisterToBookmark);
router.delete('/sessions/:id/mine', ...attendeeOnly, validate({ params: idParam }), session.removeMine);

// ---------- Exhibitors ----------
router.get('/exhibitors/profile/me', ...exhibitorOnly, exhibitor.getMyProfile);
router.put('/exhibitors/profile/me', ...exhibitorOnly, validate({ body: X.profile }), exhibitor.upsertMyProfile);
router.get('/exhibitors/dashboard', ...exhibitorOnly, exhibitor.dashboard);
router.get('/exhibitors/neighbors', ...exhibitorOnly, validate({ query: X.neighbors }), exhibitor.neighbors);
router.get('/exhibitors/directory', validate({ query: X.directory }), exhibitor.directory);
router.get('/exhibitors/:id', validate({ params: idParam }), exhibitor.getExhibitor);

// ---------- Applications ----------
router.get('/applications/mine', ...exhibitorOnly, app.myApplications);
router.post('/applications', ...exhibitorOnly, validate({ body: X.apply }), app.apply);
router.post('/applications/:id/withdraw', ...exhibitorOnly, validate({ params: idParam }), app.withdraw);
router.get('/applications', ...admin, validate({ query: X.listApplications }), app.listApplications);
router.patch('/applications/:id/review', ...admin, validate({ params: idParam, body: X.reviewApplication }), app.reviewApplication);

// ---------- Inquiries (attendee <-> exhibitor) ----------
router.get('/inquiries', protect, authorize('attendee', 'exhibitor'), inquiry.listInquiries);
router.post('/inquiries', ...attendeeOnly, writeLimiter, validate({ body: X.createInquiry }), inquiry.createInquiry);
router.get('/inquiries/:id', protect, authorize('attendee', 'exhibitor'), validate({ params: idParam }), inquiry.getInquiry);
router.post('/inquiries/:id/messages', protect, authorize('attendee', 'exhibitor'), writeLimiter, validate({ params: idParam, body: X.messageBody }), inquiry.addMessage);
router.patch('/inquiries/:id/status', ...exhibitorOnly, validate({ params: idParam, body: X.inquiryStatus }), inquiry.updateStatus);

// ---------- Support tickets (exhibitor <-> organizer) ----------
router.get('/tickets', protect, authorize('admin', 'exhibitor'), validate({ query: X.listTickets }), ticket.listTickets);
router.post('/tickets', ...exhibitorOnly, writeLimiter, validate({ body: X.createTicket }), ticket.createTicket);
router.get('/tickets/:id', protect, authorize('admin', 'exhibitor'), validate({ params: idParam }), ticket.getTicket);
router.post('/tickets/:id/messages', protect, authorize('admin', 'exhibitor'), writeLimiter, validate({ params: idParam, body: X.ticketMessage }), ticket.addMessage);
router.patch('/tickets/:id', protect, authorize('admin', 'exhibitor'), validate({ params: idParam, body: X.updateTicket }), ticket.updateTicket);

// ---------- B2B messaging ----------
router.get('/messages/conversations', ...exhibitorOnly, message.listConversations);
router.post('/messages/conversations', ...exhibitorOnly, validate({ body: X.startConversation }), message.startConversation);
router.get('/messages/conversations/:id', ...exhibitorOnly, validate({ params: idParam }), message.getMessages);
router.post('/messages/conversations/:id', ...exhibitorOnly, writeLimiter, validate({ params: idParam, body: X.messageBody }), message.sendMessage);

// ---------- Notifications, feedback, users ----------
router.get('/notifications', protect, misc.listNotifications);
router.post('/notifications/read-all', protect, misc.markAllRead);
router.patch('/notifications/:id/read', protect, validate({ params: idParam }), misc.markRead);
router.delete('/notifications/:id', protect, validate({ params: idParam }), misc.deleteNotification);

router.post('/feedback', protect, writeLimiter, validate({ body: X.createFeedback }), misc.createFeedback);
router.get('/feedback', ...admin, validate({ query: X.listFeedback }), misc.listFeedback);
router.patch('/feedback/:id', ...admin, validate({ params: idParam, body: X.updateFeedback }), misc.updateFeedback);

router.get('/users', ...admin, validate({ query: X.listUsers }), misc.listUsers);
router.patch('/users/:id', ...admin, validate({ params: idParam, body: X.updateUser }), misc.updateUser);

// ---------- Analytics ----------
router.get('/analytics/overview', ...admin, analytics.overview);
router.get('/analytics/expos/:id', ...admin, validate({ params: idParam }), analytics.expoAnalytics);
router.get('/analytics/expos/:id/report.csv', ...admin, validate({ params: idParam }), analytics.exportReport);

export default router;
