import { Booth, Application, ExhibitorProfile, Visit } from '../models/index.js';
import { ROLES, MAX_BOOTHS_PER_EXHIBITOR } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId } from '../utils/helpers.js';
import { loadOwnedExpo, loadVisibleExpo } from '../services/access.js';
import { emitToExpo, emitToAdmins } from '../services/realtime.js';
import { notify, notifyAdmins } from '../services/notification.service.js';

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

async function assertPlacement(expo, candidate, ignoreId) {
  const { cols, rows } = expo.floorPlan;
  if (candidate.x + candidate.w > cols || candidate.y + candidate.h > rows) {
    throw ApiError.badRequest(`Booth must fit inside the ${cols}×${rows} floor plan`);
  }
  const others = await Booth.find({ expo: expo._id, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) }).select('x y w h code').lean();
  const clash = others.find((o) => overlaps(candidate, o));
  if (clash) throw ApiError.conflict(`Booth overlaps with ${clash.code}`);
}

const profileMap = async (booths) => {
  const ids = [...new Set(booths.filter((b) => b.exhibitor).map((b) => String(b.exhibitor)))];
  if (!ids.length) return new Map();
  const profiles = await ExhibitorProfile.find({ user: { $in: ids } }).select('user companyName logo categories tagline').lean();
  return new Map(profiles.map((p) => [String(p.user), p]));
};

/**
 * Public-safe shape: company identity is only exposed for confirmed (booked) booths.
 * Owners/organizers also see who holds a pending reservation.
 */
const serialize = (b, profiles, { privileged = false, viewerId } = {}) => {
  const out = {
    _id: b._id, expo: b.expo, code: b.code, zone: b.zone, x: b.x, y: b.y, w: b.w, h: b.h,
    size: b.size, price: b.price, status: b.status, showcase: b.status === 'booked' ? b.showcase : undefined,
  };
  const mine = viewerId && b.exhibitor && String(b.exhibitor) === String(viewerId);
  if (mine) out.mine = true;
  if (b.exhibitor && (b.status === 'booked' || privileged || mine)) {
    const p = profiles.get(String(b.exhibitor));
    out.exhibitor = { userId: b.exhibitor, profileId: p?._id, companyName: p?.companyName, logo: p?.logo, categories: p?.categories, tagline: p?.tagline };
    if (privileged) { out.application = b.application; out.reservedAt = b.reservedAt; }
  }
  return out;
};

async function broadcast(boothDoc) {
  const b = boothDoc.toObject ? boothDoc.toObject() : boothDoc;
  const profiles = await profileMap([b]);
  emitToExpo(b.expo, 'booth:updated', serialize(b, profiles));
  emitToAdmins('analytics:tick', { expoId: b.expo });
}

export const listBooths = asyncHandler(async (req, res) => {
  const { expo, isOwner } = await loadVisibleExpo(req.params.expoId, req.user);
  const booths = await Booth.find({ expo: expo._id }).sort({ y: 1, x: 1 }).lean();
  const profiles = await profileMap(booths);
  res.json({
    success: true,
    data: {
      floorPlan: expo.floorPlan,
      booths: booths.map((b) => serialize(b, profiles, { privileged: isOwner, viewerId: req.user?._id })),
    },
  });
});

export const createBooth = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.expoId, req.user);
  const data = { w: 2, h: 2, ...req.body };
  await assertPlacement(expo, data);
  const booth = await Booth.create({ ...data, expo: expo._id });
  await broadcast(booth);
  res.status(201).json({ success: true, data: { booth } });
});

export const bulkCreateBooths = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.expoId, req.user);
  const { rows, cols, startX, startY, w, h, gapX, gapY, prefix, size, price, zone } = req.body;
  const existing = await Booth.find({ expo: expo._id }).select('x y w h code').lean();
  const codes = new Set(existing.map((b) => b.code));
  const docs = [];
  let n = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      n += 1;
      const code = `${prefix}${n}`.toUpperCase();
      const cand = { x: startX + c * (w + gapX), y: startY + r * (h + gapY), w, h };
      if (cand.x + w > expo.floorPlan.cols || cand.y + h > expo.floorPlan.rows) throw ApiError.badRequest('The grid does not fit inside the floor plan. Reduce rows/columns or enlarge the floor plan.');
      if (codes.has(code)) throw ApiError.conflict(`Booth code ${code} already exists. Choose a different prefix.`);
      if ([...existing, ...docs].some((o) => overlaps(cand, o))) throw ApiError.conflict(`Booth ${code} would overlap an existing booth`);
      docs.push({ ...cand, code, expo: expo._id, size, price, zone });
    }
  }
  const created = await Booth.insertMany(docs);
  emitToExpo(expo._id, 'booths:reload', { expoId: expo._id });
  res.status(201).json({ success: true, data: { count: created.length } });
});

export const updateBooth = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.expoId, req.user);
  assertObjectId(req.params.boothId, 'booth id');
  const booth = await Booth.findOne({ _id: req.params.boothId, expo: expo._id });
  if (!booth) throw ApiError.notFound('Booth not found');

  const { status, ...rest } = req.body;
  if (status && status !== booth.status) {
    if (booth.exhibitor) throw ApiError.conflict('Release the booth from its exhibitor before changing its status');
    if (!['available', 'blocked'].includes(status)) throw ApiError.badRequest('Use the reserve / assign actions to change a booth to reserved or booked');
    booth.status = status;
  }
  const moved = ['x', 'y', 'w', 'h'].some((k) => rest[k] !== undefined);
  booth.set(rest);
  if (moved) await assertPlacement(expo, booth.toObject(), booth._id);
  await booth.save();
  await broadcast(booth);
  res.json({ success: true, data: { booth } });
});

export const deleteBooth = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.expoId, req.user);
  assertObjectId(req.params.boothId, 'booth id');
  const booth = await Booth.findOne({ _id: req.params.boothId, expo: expo._id });
  if (!booth) throw ApiError.notFound('Booth not found');
  if (booth.exhibitor) throw ApiError.conflict('Release the booth from its exhibitor before deleting it');
  await booth.deleteOne();
  emitToExpo(expo._id, 'booth:deleted', { _id: booth._id });
  res.json({ success: true, message: 'Booth deleted' });
});

/** Exhibitor reserves an available booth. The conditional update makes this race-free. */
export const reserveBooth = asyncHandler(async (req, res) => {
  const { expo } = await loadVisibleExpo(req.params.expoId, req.user);
  assertObjectId(req.params.boothId, 'booth id');
  if (['completed', 'cancelled'].includes(expo.status)) throw ApiError.badRequest('This expo is closed');

  const application = await Application.findOne({ expo: expo._id, exhibitor: req.user._id, status: 'approved' });
  if (!application) throw ApiError.forbidden('Your application for this expo must be approved before you can reserve a booth');

  const held = await Booth.countDocuments({ expo: expo._id, exhibitor: req.user._id, status: { $in: ['reserved', 'booked'] } });
  if (held >= MAX_BOOTHS_PER_EXHIBITOR) throw ApiError.conflict(`You can hold at most ${MAX_BOOTHS_PER_EXHIBITOR} booths per expo`);

  const booth = await Booth.findOneAndUpdate(
    { _id: req.params.boothId, expo: expo._id, status: 'available' },
    { $set: { status: 'reserved', exhibitor: req.user._id, application: application._id, reservedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!booth) throw ApiError.conflict('Sorry, this booth is no longer available');

  await broadcast(booth);
  notifyAdmins({ type: 'booth', title: `Booth ${booth.code} reserved`, body: `${req.user.company || req.user.name} reserved booth ${booth.code} at ${expo.title}. Confirm or release it.`, link: `/admin/floor-plan?expo=${expo._id}` });
  res.json({ success: true, data: { booth } });
});

export const releaseBooth = asyncHandler(async (req, res) => {
  const { expo, isOwner } = await loadVisibleExpo(req.params.expoId, req.user);
  assertObjectId(req.params.boothId, 'booth id');
  const booth = await Booth.findOne({ _id: req.params.boothId, expo: expo._id });
  if (!booth || !booth.exhibitor) throw ApiError.notFound('Booth not found');

  const isHolder = String(booth.exhibitor) === String(req.user._id);
  if (!isOwner && !isHolder) throw ApiError.forbidden();
  if (isHolder && !isOwner && booth.status === 'booked') throw ApiError.forbidden('Confirmed booths can only be released by the organizer. Please open a support ticket.');

  const previous = booth.exhibitor;
  Object.assign(booth, { status: 'available', exhibitor: null, application: null, reservedAt: undefined, showcase: { tagline: '', description: '', products: [] } });
  await booth.save();
  await broadcast(booth);
  if (isOwner) notify(previous, { type: 'booth', title: `Booth ${booth.code} released`, body: `The organizer released booth ${booth.code} at ${expo.title}.`, link: '/exhibitor/booths' });
  res.json({ success: true, data: { booth } });
});

export const confirmBooth = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.expoId, req.user);
  assertObjectId(req.params.boothId, 'booth id');
  const booth = await Booth.findOneAndUpdate({ _id: req.params.boothId, expo: expo._id, status: 'reserved' }, { $set: { status: 'booked' } }, { returnDocument: 'after' });
  if (!booth) throw ApiError.conflict('Only reserved booths can be confirmed');
  await broadcast(booth);
  notify(booth.exhibitor, { type: 'booth', title: `Booth ${booth.code} confirmed`, body: `Your booth ${booth.code} at ${expo.title} is confirmed.`, link: '/exhibitor/booths' });
  res.json({ success: true, data: { booth } });
});

export const assignBooth = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.expoId, req.user);
  assertObjectId(req.params.boothId, 'booth id');
  const application = await Application.findOne({ expo: expo._id, exhibitor: req.body.exhibitorId, status: 'approved' });
  if (!application) throw ApiError.badRequest('That exhibitor does not have an approved application for this expo');

  const booth = await Booth.findOneAndUpdate(
    { _id: req.params.boothId, expo: expo._id, status: { $in: ['available', 'reserved'] } },
    { $set: { status: 'booked', exhibitor: application.exhibitor, application: application._id, reservedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!booth) throw ApiError.conflict('This booth cannot be assigned (it is blocked or already booked)');
  await broadcast(booth);
  notify(application.exhibitor, { type: 'booth', title: `Booth ${booth.code} assigned`, body: `The organizer assigned booth ${booth.code} to you at ${expo.title}.`, link: '/exhibitor/booths' });
  res.json({ success: true, data: { booth } });
});

export const updateShowcase = asyncHandler(async (req, res) => {
  assertObjectId(req.params.boothId, 'booth id');
  const booth = await Booth.findOne({ _id: req.params.boothId, expo: req.params.expoId, exhibitor: req.user._id });
  if (!booth) throw ApiError.notFound('Booth not found');
  booth.set('showcase', { ...(booth.toObject().showcase || {}), ...req.body });
  await booth.save();
  await broadcast(booth);
  res.json({ success: true, data: { booth } });
});

export const myBooths = asyncHandler(async (req, res) => {
  const booths = await Booth.find({ exhibitor: req.user._id }).populate('expo', 'title startDate endDate status location').sort('-reservedAt').lean();
  res.json({ success: true, data: { items: booths.filter((b) => b.expo) } });
});

const VISIT_COOLDOWN_MS = 30 * 60 * 1000;
export const recordVisit = asyncHandler(async (req, res) => {
  assertObjectId(req.params.boothId, 'booth id');
  const booth = await Booth.findOne({ _id: req.params.boothId, expo: req.params.expoId }).select('_id expo').lean();
  if (!booth) throw ApiError.notFound('Booth not found');
  if (req.user?.role !== ROLES.ADMIN) {
    const recent = req.user && (await Visit.exists({ booth: booth._id, user: req.user._id, at: { $gt: new Date(Date.now() - VISIT_COOLDOWN_MS) } }));
    if (!recent) {
      await Visit.create({ expo: booth.expo, type: 'booth', booth: booth._id, user: req.user?._id });
      emitToAdmins('analytics:tick', { expoId: booth.expo });
    }
  }
  res.status(204).end();
});
