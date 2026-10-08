import { Expo, Booth, Session, Application, ExpoRegistration, SessionRegistration, Visit, Inquiry, Ticket } from '../models/index.js';
import { ROLES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex, parsePagination, paginated } from '../utils/helpers.js';
import { loadOwnedExpo, loadVisibleExpo, PUBLIC_EXPO_STATUSES } from '../services/access.js';
import { emitToExpo } from '../services/realtime.js';
import { notify } from '../services/notification.service.js';

/** Adds booth / exhibitor counters to a list of expo documents with 2 aggregate queries (no N+1). */
async function withStats(expos) {
  if (!expos.length) return expos;
  const ids = expos.map((e) => e._id);
  const [booths, regs] = await Promise.all([
    Booth.aggregate([{ $match: { expo: { $in: ids } } }, { $group: { _id: { expo: '$expo', status: '$status' }, n: { $sum: 1 } } }]),
    ExpoRegistration.aggregate([{ $match: { expo: { $in: ids } } }, { $group: { _id: '$expo', n: { $sum: 1 } } }]),
  ]);
  const stats = new Map(ids.map((id) => [String(id), { booths: 0, available: 0, booked: 0, reserved: 0, attendees: 0 }]));
  for (const b of booths) {
    const s = stats.get(String(b._id.expo));
    s.booths += b.n;
    if (b._id.status in s) s[b._id.status] += b.n;
  }
  for (const r of regs) stats.get(String(r._id)).attendees = r.n;
  return expos.map((e) => ({ ...e, stats: stats.get(String(e._id)) }));
}

export const listExpos = asyncHandler(async (req, res) => {
  const { q, status, upcoming, featured, mine } = req.query;
  const pg = parsePagination(req.query, { defaultLimit: 12 });
  const filter = {};

  if (mine === 'true' && req.user?.role === ROLES.ADMIN) {
    filter.organizer = req.user._id;
    if (status) filter.status = status;
  } else {
    filter.status = status && PUBLIC_EXPO_STATUSES.includes(status) ? status : { $in: PUBLIC_EXPO_STATUSES };
  }
  if (upcoming === 'true') filter.endDate = { $gte: new Date() };
  if (featured === 'true') filter.featured = true;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { theme: rx }, { 'location.city': rx }, { 'location.venue': rx }];
  }

  const [items, total] = await Promise.all([
    Expo.find(filter).sort(upcoming === 'true' ? { startDate: 1 } : { startDate: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Expo.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginated(await withStats(items), total, pg) });
});

export const getExpo = asyncHandler(async (req, res) => {
  const { expo, isOwner } = await loadVisibleExpo(req.params.id, req.user);
  const [withStat] = await withStats([expo.toObject()]);
  const extra = { isOwner };
  if (req.user?.role === ROLES.ATTENDEE) {
    extra.registered = !!(await ExpoRegistration.exists({ user: req.user._id, expo: expo._id }));
  }
  if (req.user && req.user.role !== ROLES.ADMIN) {
    Visit.create({ expo: expo._id, type: 'expo', user: req.user._id }).catch(() => {});
  }
  res.json({ success: true, data: { expo: { ...withStat, ...extra } } });
});

export const createExpo = asyncHandler(async (req, res) => {
  const expo = await Expo.create({ ...req.body, organizer: req.user._id });
  res.status(201).json({ success: true, data: { expo } });
});

export const updateExpo = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.id, req.user);
  if (req.body.floorPlan) {
    // Shrinking the floor plan must not orphan existing booths
    const { cols = expo.floorPlan.cols, rows = expo.floorPlan.rows } = req.body.floorPlan;
    const outside = await Booth.exists({ expo: expo._id, $expr: { $or: [{ $gt: [{ $add: ['$x', '$w'] }, cols] }, { $gt: [{ $add: ['$y', '$h'] }, rows] }] } });
    if (outside) throw ApiError.conflict('Some booths would fall outside the smaller floor plan. Move or delete them first.');
  }
  const wasStatus = expo.status;
  expo.set(req.body);
  await expo.save();
  emitToExpo(expo._id, 'expo:updated', { expoId: expo._id, title: expo.title, status: expo.status });

  if (wasStatus !== expo.status && expo.status === 'cancelled') {
    const regs = await ExpoRegistration.find({ expo: expo._id }).select('user').lean();
    await Promise.all(regs.map((r) => notify(r.user, { type: 'expo', title: `${expo.title} was cancelled`, body: 'The organizer has cancelled this expo.', link: `/attendee/expos/${expo._id}` })));
  }
  res.json({ success: true, data: { expo } });
});

export const deleteExpo = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.id, req.user);
  const id = expo._id;
  await Promise.all([
    Booth.deleteMany({ expo: id }), Session.deleteMany({ expo: id }), Application.deleteMany({ expo: id }),
    ExpoRegistration.deleteMany({ expo: id }), SessionRegistration.deleteMany({ expo: id }),
    Visit.deleteMany({ expo: id }), Inquiry.deleteMany({ expo: id }), Ticket.updateMany({ expo: id }, { $unset: { expo: '' } }),
  ]);
  await expo.deleteOne();
  res.json({ success: true, message: 'Expo and all related data deleted' });
});

// ---- Attendee registration for an expo
export const registerForExpo = asyncHandler(async (req, res) => {
  const { expo } = await loadVisibleExpo(req.params.id, req.user);
  if (['completed', 'cancelled'].includes(expo.status)) throw ApiError.badRequest('Registration is closed for this expo');
  if (expo.capacity > 0 && (await ExpoRegistration.countDocuments({ expo: expo._id })) >= expo.capacity) {
    throw ApiError.conflict('This expo has reached its attendee capacity');
  }
  await ExpoRegistration.updateOne({ user: req.user._id, expo: expo._id }, { $setOnInsert: { user: req.user._id, expo: expo._id } }, { upsert: true });
  notify(req.user._id, { type: 'expo', title: `You're registered for ${expo.title}`, body: 'Browse the schedule and bookmark the sessions you want to attend.', link: `/attendee/expos/${expo._id}` });
  res.status(201).json({ success: true, message: 'Registered' });
});

export const unregisterFromExpo = asyncHandler(async (req, res) => {
  await ExpoRegistration.deleteOne({ user: req.user._id, expo: req.params.id });
  await SessionRegistration.deleteMany({ user: req.user._id, expo: req.params.id });
  res.json({ success: true, message: 'Registration cancelled' });
});

export const myRegistrations = asyncHandler(async (req, res) => {
  const regs = await ExpoRegistration.find({ user: req.user._id }).sort('-createdAt').populate('expo').lean();
  res.json({ success: true, data: { items: regs.filter((r) => r.expo).map((r) => ({ ...r.expo, registeredAt: r.createdAt })) } });
});
