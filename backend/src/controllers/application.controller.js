import { Application, ExhibitorProfile, Expo, Booth } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId, escapeRegex, parsePagination, paginated } from '../utils/helpers.js';
import { PUBLIC_EXPO_STATUSES } from '../services/access.js';
import { notify, notifyAdmins } from '../services/notification.service.js';
import { emitToAdmins, emitToExpo } from '../services/realtime.js';

export const apply = asyncHandler(async (req, res) => {
  const { expoId, ...body } = req.body;
  const expo = await Expo.findById(expoId);
  if (!expo || !PUBLIC_EXPO_STATUSES.includes(expo.status) || ['completed', 'cancelled'].includes(expo.status)) {
    throw ApiError.badRequest('This expo is not accepting applications');
  }
  const profile = await ExhibitorProfile.findOne({ user: req.user._id });
  if (!profile) throw ApiError.badRequest('Complete your company profile before applying');

  // A previously rejected/withdrawn application may be re-submitted
  const existing = await Application.findOne({ expo: expoId, exhibitor: req.user._id });
  if (existing && ['pending', 'approved'].includes(existing.status)) throw ApiError.conflict('You have already applied to this expo');

  const application = existing || new Application({ expo: expoId, exhibitor: req.user._id });
  application.set({ ...body, profile: profile._id, status: 'pending', reviewedBy: undefined, reviewedAt: undefined, rejectionReason: undefined });
  await application.save();

  notifyAdmins({ type: 'application', title: 'New exhibitor application', body: `${profile.companyName} applied to ${expo.title}.`, link: '/admin/applications' });
  emitToAdmins('application:new', { applicationId: application._id });
  res.status(201).json({ success: true, data: { application } });
});

export const myApplications = asyncHandler(async (req, res) => {
  const items = await Application.find({ exhibitor: req.user._id }).sort('-updatedAt').populate('expo', 'title startDate endDate status location banner').lean();
  res.json({ success: true, data: { items: items.filter((a) => a.expo) } });
});

export const withdraw = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'application id');
  const application = await Application.findOne({ _id: req.params.id, exhibitor: req.user._id });
  if (!application) throw ApiError.notFound('Application not found');
  if (!['pending', 'approved'].includes(application.status)) throw ApiError.badRequest('This application cannot be withdrawn');
  const confirmed = await Booth.exists({ application: application._id, status: 'booked' });
  if (confirmed) throw ApiError.conflict('You hold a confirmed booth. Please contact the organizer to cancel it first.');
  await Booth.updateMany({ application: application._id }, { $set: { status: 'available', exhibitor: null, application: null }, $unset: { reservedAt: '' } });
  emitToExpo(application.expo, 'booths:reload', { expoId: application.expo });
  application.status = 'withdrawn';
  await application.save();
  res.json({ success: true, data: { application } });
});

/** Organizer queue: only applications for expos the organizer owns. */
export const listApplications = asyncHandler(async (req, res) => {
  const { expo, status, q } = req.query;
  const pg = parsePagination(req.query);
  const owned = await Expo.find({ organizer: req.user._id }).select('_id title').lean();
  const ownedIds = owned.map((e) => e._id);
  const filter = { expo: expo ? { $in: ownedIds.filter((id) => String(id) === expo) } : { $in: ownedIds } };
  if (status) filter.status = status;
  if (q) {
    const profiles = await ExhibitorProfile.find({ companyName: new RegExp(escapeRegex(q), 'i') }).select('_id').lean();
    filter.profile = { $in: profiles.map((p) => p._id) };
  }
  const [items, total, counts] = await Promise.all([
    Application.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit)
      .populate('expo', 'title startDate').populate('profile', 'companyName logo categories contact tagline').populate('exhibitor', 'name email phone').lean(),
    Application.countDocuments(filter),
    Application.aggregate([{ $match: { expo: { $in: ownedIds } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  res.json({ success: true, data: { ...paginated(items, total, pg), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) } });
});

export const reviewApplication = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'application id');
  const application = await Application.findById(req.params.id).populate('expo');
  if (!application || String(application.expo?.organizer) !== String(req.user._id)) throw ApiError.notFound('Application not found');
  if (application.status !== 'pending') throw ApiError.conflict(`This application was already ${application.status}`);

  const { status, reason } = req.body;
  application.status = status;
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();
  application.rejectionReason = status === 'rejected' ? reason : undefined;
  await application.save();

  const title = application.expo.title;
  await notify(application.exhibitor, status === 'approved'
    ? { type: 'application', title: `Application approved — ${title}`, body: 'You can now choose and reserve your booth on the floor plan.', link: '/exhibitor/booths' }
    : { type: 'application', title: `Application not approved — ${title}`, body: reason, link: '/exhibitor/applications' });
  res.json({ success: true, data: { application } });
});

/** Approved exhibitors of an expo (used by the organizer to assign booths). */
export const approvedExhibitors = asyncHandler(async (req, res) => {
  assertObjectId(req.params.expoId, 'expo id');
  const expo = await Expo.findOne({ _id: req.params.expoId, organizer: req.user._id }).select('_id').lean();
  if (!expo) throw ApiError.notFound('Expo not found');
  const apps = await Application.find({ expo: expo._id, status: 'approved' }).populate('profile', 'companyName logo').lean();
  const holding = await Booth.find({ expo: expo._id, exhibitor: { $ne: null } }).select('exhibitor code status').lean();
  const byUser = holding.reduce((m, b) => ({ ...m, [b.exhibitor]: [...(m[b.exhibitor] || []), { code: b.code, status: b.status }] }), {});
  res.json({ success: true, data: { items: apps.map((a) => ({ userId: a.exhibitor, companyName: a.profile?.companyName, logo: a.profile?.logo, booths: byUser[a.exhibitor] || [] })) } });
});
