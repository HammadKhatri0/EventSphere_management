import { ExhibitorProfile, Booth, Expo, Application, Ticket, Inquiry, Conversation, Visit } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId, escapeRegex, parsePagination, paginated } from '../utils/helpers.js';
import { PUBLIC_EXPO_STATUSES } from '../services/access.js';

// ---- Own profile
export const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await ExhibitorProfile.findOne({ user: req.user._id });
  res.json({ success: true, data: { profile } });
});

export const upsertMyProfile = asyncHandler(async (req, res) => {
  const profile = await ExhibitorProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: req.body, $setOnInsert: { user: req.user._id } },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json({ success: true, data: { profile } });
});

const PROFILE_CARD = 'user companyName tagline logo categories description website products.name';

/** Public directory of exhibitors holding a confirmed booth in visible expos. */
export const directory = asyncHandler(async (req, res) => {
  const { expo, q, category, product, sort } = req.query;
  const pg = parsePagination(req.query, { defaultLimit: 12 });

  let expoIds;
  if (expo) {
    const e = await Expo.findOne({ _id: expo, status: { $in: PUBLIC_EXPO_STATUSES } }).select('_id').lean();
    expoIds = e ? [e._id] : [];
  } else {
    expoIds = (await Expo.find({ status: { $in: ['published', 'ongoing'] } }).select('_id').lean()).map((e) => e._id);
  }
  const booths = await Booth.find({ expo: { $in: expoIds }, status: 'booked', exhibitor: { $ne: null } }).select('exhibitor expo code').lean();
  const userIds = [...new Set(booths.map((b) => String(b.exhibitor)))];

  const filter = { user: { $in: userIds } };
  const and = [];
  if (category) filter.categories = category;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ companyName: rx }, { tagline: rx }, { description: rx }, { 'products.name': rx }, { 'products.description': rx }] });
  }
  if (product) and.push({ 'products.name': new RegExp(escapeRegex(product), 'i') });
  if (and.length) filter.$and = and;

  const [items, total] = await Promise.all([
    ExhibitorProfile.find(filter).select(PROFILE_CARD).sort(sort === 'recent' ? { updatedAt: -1 } : { companyName: 1 }).skip(pg.skip).limit(pg.limit).lean(),
    ExhibitorProfile.countDocuments(filter),
  ]);
  const boothsByUser = booths.reduce((m, b) => { (m[b.exhibitor] ||= []).push({ _id: b._id, code: b.code, expo: b.expo }); return m; }, {});
  const result = items.map((p) => ({ ...p, products: p.products?.slice(0, 4).map((x) => x.name), booths: boothsByUser[p.user] || [] }));
  res.json({ success: true, data: paginated(result, total, pg) });
});

export const getExhibitor = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'exhibitor id');
  const profile = await ExhibitorProfile.findById(req.params.id).select('-documents.uploadedAt').lean();
  if (!profile) throw ApiError.notFound('Exhibitor not found');
  const visible = await Expo.find({ status: { $in: PUBLIC_EXPO_STATUSES } }).select('_id title startDate location').lean();
  const booths = await Booth.find({ exhibitor: profile.user, status: 'booked', expo: { $in: visible.map((e) => e._id) } }).select('code expo zone x y w h showcase').lean();
  if (!booths.length) throw ApiError.notFound('Exhibitor not found');
  const expoMap = new Map(visible.map((e) => [String(e._id), e]));
  // Only names/roles of staff are public; personal phone/email stay private
  profile.staff = (profile.staff || []).map(({ name, role }) => ({ name, role }));
  res.json({ success: true, data: { profile: { ...profile, userId: profile.user }, booths: booths.map((b) => ({ ...b, expo: expoMap.get(String(b.expo)) })) } });
});

/**
 * Neighbouring exhibitors: those with a confirmed/reserved booth within `RANGE` grid cells
 * of one of the requester's booths in the same expo ("scope=all" lists every exhibitor of the expo).
 */
const RANGE = 3;
export const neighbors = asyncHandler(async (req, res) => {
  const { expo, scope } = req.query;
  const mine = await Booth.find({ expo, exhibitor: req.user._id, status: { $in: ['reserved', 'booked'] } }).lean();
  if (!mine.length) throw ApiError.badRequest('Reserve a booth in this expo to see your neighbours');

  const others = await Booth.find({ expo, exhibitor: { $nin: [null, req.user._id] }, status: { $in: ['reserved', 'booked'] } }).lean();
  const gap = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  const near = new Map();
  for (const o of others) {
    const d = Math.min(...mine.map((m) => gap(m, o)));
    if (scope === 'all' || d <= RANGE) {
      const key = String(o.exhibitor);
      const cur = near.get(key);
      if (!cur || d < cur.distance) near.set(key, { userId: o.exhibitor, booth: o.code, distance: d });
    }
  }
  const profiles = await ExhibitorProfile.find({ user: { $in: [...near.keys()] } }).select('user companyName logo tagline categories contact').lean();
  const items = profiles.map((p) => ({ ...p, ...near.get(String(p.user)) })).sort((a, b) => a.distance - b.distance);
  res.json({ success: true, data: { items } });
});

/** Overview numbers for the exhibitor dashboard. */
export const dashboard = asyncHandler(async (req, res) => {
  const id = req.user._id;
  const myBooths = await Booth.find({ exhibitor: id }).populate('expo', 'title startDate').lean();
  const [profile, applications, tickets, inquiries, conversations, visits] = await Promise.all([
    ExhibitorProfile.findOne({ user: id }).select('companyName logo description products documents staff').lean(),
    Application.find({ exhibitor: id }).populate('expo', 'title startDate').sort('-updatedAt').limit(5).lean(),
    Ticket.aggregate([{ $match: { exhibitor: id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Inquiry.aggregate([{ $match: { exhibitor: id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Conversation.find({ participants: id }).select('unread').lean(),
    Visit.countDocuments({ booth: { $in: myBooths.map((b) => b._id) }, type: 'booth' }),
  ]);
  const unreadMessages = conversations.reduce((sum, c) => sum + (c.unread?.[String(id)] || 0), 0);
  const completeness = profile
    ? Math.round(([profile.companyName, profile.logo, profile.description, profile.products?.length, profile.documents?.length, profile.staff?.length].filter(Boolean).length / 6) * 100)
    : 0;
  res.json({
    success: true,
    data: {
      profileCompleteness: completeness,
      applications: applications.filter((a) => a.expo),
      booths: myBooths.filter((b) => b.expo),
      tickets: Object.fromEntries(tickets.map((t) => [t._id, t.n])),
      inquiries: Object.fromEntries(inquiries.map((t) => [t._id, t.n])),
      unreadMessages,
      boothVisits: visits,
    },
  });
});
