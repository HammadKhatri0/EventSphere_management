import { Notification, Feedback, User, ExhibitorProfile } from '../models/index.js';
import { ROLES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId, escapeRegex, parsePagination, paginated } from '../utils/helpers.js';
import { notifyAdmins, notify } from '../services/notification.service.js';
import { revokeAllForUser } from '../services/token.service.js';

// ---------------- Notifications ----------------
export const listNotifications = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query, { defaultLimit: 20 });
  const filter = { user: req.user._id, ...(req.query.unread === 'true' ? { read: false } : {}) };
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort('-createdAt').skip(pg.skip).limit(pg.limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ success: true, data: { ...paginated(items, total, pg), unreadCount } });
});

export const markRead = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'notification id');
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { read: true } });
  res.json({ success: true });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.json({ success: true });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'notification id');
  await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ success: true });
});

// ---------------- Feedback ----------------
export const createFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.create({ ...req.body, user: req.user._id });
  notifyAdmins({ type: 'feedback', title: `New ${feedback.type} from ${req.user.name}`, body: feedback.message.slice(0, 120), link: '/admin/feedback' });
  res.status(201).json({ success: true, data: { feedback } });
});

export const listFeedback = asyncHandler(async (req, res) => {
  const pg = parsePagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  const [items, total] = await Promise.all([
    Feedback.find(filter).sort('-createdAt').skip(pg.skip).limit(pg.limit).populate('user', 'name email role').lean(),
    Feedback.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginated(items, total, pg) });
});

export const updateFeedback = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'feedback id');
  const feedback = await Feedback.findByIdAndUpdate(req.params.id, { status: req.body.status }, { returnDocument: 'after' });
  if (!feedback) throw ApiError.notFound('Feedback not found');
  if (req.body.status === 'resolved') notify(feedback.user, { type: 'feedback', title: 'Your feedback was resolved', body: 'Thanks for helping us improve EventSphere.' });
  res.json({ success: true, data: { feedback } });
});

// ---------------- Users (organizer administration) ----------------
export const listUsers = asyncHandler(async (req, res) => {
  const { q, role, active } = req.query;
  const pg = parsePagination(req.query);
  const filter = {};
  if (role) filter.role = role;
  if (active) filter.isActive = active === 'true';
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { company: rx }];
  }
  const [items, total, counts] = await Promise.all([
    User.find(filter).sort('-createdAt').skip(pg.skip).limit(pg.limit).lean(),
    User.countDocuments(filter),
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
  ]);
  items.forEach((u) => { delete u.password; delete u.__v; });
  res.json({ success: true, data: { ...paginated(items, total, pg), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) } });
});

export const updateUser = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'user id');
  if (String(req.params.id) === String(req.user._id)) throw ApiError.badRequest('You cannot change your own role or status');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (req.body.role && req.body.role !== user.role) {
    user.role = req.body.role;
    if (user.role === ROLES.EXHIBITOR && !(await ExhibitorProfile.exists({ user: user._id }))) {
      await ExhibitorProfile.create({ user: user._id, companyName: user.company || user.name, contact: { email: user.email } });
    }
  }
  if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
  await user.save();
  if (!user.isActive) await revokeAllForUser(user._id);
  res.json({ success: true, data: { user } });
});
