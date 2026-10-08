import { Session, SessionRegistration, ExpoRegistration } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId, escapeRegex } from '../utils/helpers.js';
import { loadOwnedExpo, loadVisibleExpo } from '../services/access.js';
import { emitToExpo } from '../services/realtime.js';
import { notifyMany } from '../services/notification.service.js';

const MIN = 60000;
const remindAtFor = (session, minutes) => {
  const at = new Date(session.startTime.getTime() - minutes * MIN);
  return at > new Date() ? at : null;
};

/** Rejects a session that double-books a room or a speaker. */
async function assertNoConflict(expoId, data, ignoreId) {
  const base = { expo: expoId, startTime: { $lt: data.endTime }, endTime: { $gt: data.startTime }, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) };
  const room = await Session.findOne({ ...base, location: data.location }).select('title').lean();
  if (room) throw ApiError.conflict(`"${room.title}" is already scheduled in ${data.location} at that time`);
  const names = (data.speakers || []).map((s) => s.name).filter(Boolean);
  if (names.length) {
    const sp = await Session.findOne({ ...base, 'speakers.name': { $in: names } }).select('title speakers.name').lean();
    if (sp) throw ApiError.conflict(`A speaker is already presenting "${sp.title}" at that time`);
  }
}

export const listSessions = asyncHandler(async (req, res) => {
  const { expo } = await loadVisibleExpo(req.params.expoId, req.user);
  const { q, type, topic, day } = req.query;
  const filter = { expo: expo._id };
  if (type) filter.type = type;
  if (topic) filter.topic = topic;
  if (day) {
    const start = new Date(`${day}T00:00:00.000Z`);
    // generous 36h window so that any timezone's local day is covered; the client groups by local day
    filter.startTime = { $gte: new Date(start.getTime() - 14 * 60 * MIN), $lt: new Date(start.getTime() + 38 * 60 * MIN) };
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { topic: rx }, { 'speakers.name': rx }, { location: rx }];
  }
  const sessions = await Session.find(filter).sort({ startTime: 1, location: 1 }).lean();
  let mine = new Map();
  if (req.user) {
    const regs = await SessionRegistration.find({ user: req.user._id, session: { $in: sessions.map((s) => s._id) } }).select('session kind reminderMinutes').lean();
    mine = new Map(regs.map((r) => [String(r.session), r]));
  }
  res.json({
    success: true,
    data: { items: sessions.map((s) => ({ ...s, my: mine.get(String(s._id)) ? { kind: mine.get(String(s._id)).kind, reminderMinutes: mine.get(String(s._id)).reminderMinutes } : null })) },
  });
});

export const createSession = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.expoId, req.user);
  await assertNoConflict(expo._id, req.body);
  const session = await Session.create({ ...req.body, expo: expo._id });
  emitToExpo(expo._id, 'schedule:updated', { expoId: expo._id, sessionId: session._id, action: 'created' });
  res.status(201).json({ success: true, data: { session } });
});

const loadOwnedSession = async (id, user) => {
  assertObjectId(id, 'session id');
  const session = await Session.findById(id);
  if (!session) throw ApiError.notFound('Session not found');
  await loadOwnedExpo(session.expo, user);
  return session;
};

export const updateSession = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.user);
  const before = { start: +session.startTime, loc: session.location };
  session.set(req.body);
  if (session.endTime <= session.startTime) throw ApiError.badRequest('End time must be after the start time');
  if (session.capacity > 0 && session.capacity < session.registeredCount) throw ApiError.conflict(`Capacity cannot be lower than the ${session.registeredCount} people already registered`);
  await assertNoConflict(session.expo, session, session._id);
  await session.save();

  const changed = before.start !== +session.startTime || before.loc !== session.location;
  if (changed) {
    const regs = await SessionRegistration.find({ session: session._id }).select('user reminderMinutes').lean();
    await SessionRegistration.bulkWrite(regs.map((r) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { remindAt: remindAtFor(session, r.reminderMinutes), reminderSent: false } } } })));
    await notifyMany(regs.map((r) => r.user), {
      type: 'schedule', title: `Schedule change: ${session.title}`,
      body: `Now ${session.startTime.toUTCString().slice(0, 22)} UTC in ${session.location}.`, link: `/attendee/schedule?expo=${session.expo}`,
    });
  }
  emitToExpo(session.expo, 'schedule:updated', { expoId: session.expo, sessionId: session._id, action: 'updated' });
  res.json({ success: true, data: { session } });
});

export const deleteSession = asyncHandler(async (req, res) => {
  const session = await loadOwnedSession(req.params.id, req.user);
  const regs = await SessionRegistration.find({ session: session._id }).select('user').lean();
  await SessionRegistration.deleteMany({ session: session._id });
  await session.deleteOne();
  await notifyMany(regs.map((r) => r.user), { type: 'schedule', title: `Session cancelled: ${session.title}`, body: 'This session was removed from the schedule.', link: `/attendee/schedule?expo=${session.expo}` });
  emitToExpo(session.expo, 'schedule:updated', { expoId: session.expo, sessionId: session._id, action: 'deleted' });
  res.json({ success: true, message: 'Session deleted' });
});

// ---------------- Attendee: bookmark / register / reminders ----------------
const loadSession = async (id) => {
  assertObjectId(id, 'session id');
  const session = await Session.findById(id);
  if (!session) throw ApiError.notFound('Session not found');
  return session;
};

export const bookmark = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.id);
  await loadVisibleExpo(session.expo, req.user);
  const existing = await SessionRegistration.findOne({ user: req.user._id, session: session._id });
  if (existing) {
    if (existing.kind === 'bookmark' && req.body.reminderMinutes !== undefined) {
      existing.set({ reminderMinutes: req.body.reminderMinutes, remindAt: remindAtFor(session, req.body.reminderMinutes), reminderSent: false });
      await existing.save();
    }
    return res.json({ success: true, data: { kind: existing.kind } });
  }
  const minutes = req.body.reminderMinutes ?? 15;
  await SessionRegistration.create({ user: req.user._id, session: session._id, expo: session.expo, kind: 'bookmark', reminderMinutes: minutes, remindAt: remindAtFor(session, minutes) });
  await Session.updateOne({ _id: session._id }, { $inc: { bookmarkCount: 1 } });
  res.status(201).json({ success: true, data: { kind: 'bookmark' } });
});

export const register = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.id);
  await loadVisibleExpo(session.expo, req.user);
  if (session.endTime < new Date()) throw ApiError.badRequest('This session has already ended');
  const existing = await SessionRegistration.findOne({ user: req.user._id, session: session._id });
  const minutes = req.body.reminderMinutes ?? existing?.reminderMinutes ?? 15;

  if (existing?.kind === 'registered') {
    existing.set({ reminderMinutes: minutes, remindAt: remindAtFor(session, minutes), reminderSent: false });
    await existing.save();
    return res.json({ success: true, data: { kind: 'registered' } });
  }
  // Atomic seat reservation: never oversells even under concurrent requests
  const seat = await Session.findOneAndUpdate(
    { _id: session._id, ...(session.capacity > 0 ? { $expr: { $lt: ['$registeredCount', '$capacity'] } } : {}) },
    { $inc: { registeredCount: 1, ...(existing ? { bookmarkCount: -1 } : {}) } },
    { returnDocument: 'after' }
  );
  if (!seat) throw ApiError.conflict('Sorry, this session is full');

  try {
    await SessionRegistration.updateOne(
      { user: req.user._id, session: session._id },
      { $set: { kind: 'registered', expo: session.expo, reminderMinutes: minutes, remindAt: remindAtFor(session, minutes), reminderSent: false } },
      { upsert: true }
    );
  } catch (err) {
    await Session.updateOne({ _id: session._id }, { $inc: { registeredCount: -1 } });
    throw err;
  }
  await ExpoRegistration.updateOne({ user: req.user._id, expo: session.expo }, { $setOnInsert: { user: req.user._id, expo: session.expo } }, { upsert: true });

  const clash = await SessionRegistration.find({ user: req.user._id, kind: 'registered', session: { $ne: session._id } }).populate({ path: 'session', match: { startTime: { $lt: session.endTime }, endTime: { $gt: session.startTime } }, select: 'title' }).lean();
  const overlapping = clash.find((c) => c.session);
  emitToExpo(session.expo, 'schedule:updated', { expoId: session.expo, sessionId: session._id, action: 'counts' });
  res.status(201).json({ success: true, data: { kind: 'registered', warning: overlapping ? `Heads up: this overlaps with "${overlapping.session.title}"` : undefined } });
});

export const removeMine = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.id);
  const reg = await SessionRegistration.findOneAndDelete({ user: req.user._id, session: session._id });
  if (reg) {
    const field = reg.kind === 'registered' ? 'registeredCount' : 'bookmarkCount';
    await Session.updateOne({ _id: session._id, [field]: { $gt: 0 } }, { $inc: { [field]: -1 } });
    emitToExpo(session.expo, 'schedule:updated', { expoId: session.expo, sessionId: session._id, action: 'counts' });
  }
  res.json({ success: true, message: 'Removed from your agenda' });
});

export const unregisterToBookmark = asyncHandler(async (req, res) => {
  const session = await loadSession(req.params.id);
  const reg = await SessionRegistration.findOneAndUpdate({ user: req.user._id, session: session._id, kind: 'registered' }, { $set: { kind: 'bookmark' } });
  if (reg) await Session.updateOne({ _id: session._id, registeredCount: { $gt: 0 } }, { $inc: { registeredCount: -1, bookmarkCount: 1 } });
  res.json({ success: true, message: 'Registration cancelled (session kept as a bookmark)' });
});

export const myAgenda = asyncHandler(async (req, res) => {
  const regs = await SessionRegistration.find({ user: req.user._id })
    .populate({ path: 'session', populate: { path: 'expo', select: 'title' } }).lean();
  const items = regs.filter((r) => r.session).map((r) => ({ ...r.session, my: { kind: r.kind, reminderMinutes: r.reminderMinutes } })).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  res.json({ success: true, data: { items } });
});
