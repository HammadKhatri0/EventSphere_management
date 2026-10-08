import { Expo, Booth, Application, ExpoRegistration, Session, SessionRegistration, Visit, Inquiry, Ticket, ExhibitorProfile } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { loadOwnedExpo } from '../services/access.js';

const day = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));

/** Builds the full analytics payload for one expo (all queries run in parallel). */
export async function buildExpoAnalytics(expo) {
  const id = expo._id;
  const [boothStatus, appStatus, attendees, regsByDay, sessions, sessionTotals, traffic, visitsByDay, inquiries, revenue, approvedApps] = await Promise.all([
    Booth.aggregate([{ $match: { expo: id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Application.aggregate([{ $match: { expo: id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ExpoRegistration.countDocuments({ expo: id }),
    ExpoRegistration.aggregate([{ $match: { expo: id } }, { $group: { _id: day, n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Session.find({ expo: id }).select('title type location startTime capacity registeredCount bookmarkCount').lean(),
    SessionRegistration.aggregate([{ $match: { expo: id } }, { $group: { _id: '$kind', n: { $sum: 1 } } }]),
    Visit.aggregate([{ $match: { expo: id, type: 'booth' } }, { $group: { _id: '$booth', n: { $sum: 1 } } }]),
    Visit.aggregate([{ $match: { expo: id, at: { $gte: new Date(Date.now() - 30 * 86_400_000) } } }, { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$at' } }, t: '$type' }, n: { $sum: 1 } } }, { $sort: { '_id.d': 1 } }]),
    Inquiry.aggregate([{ $match: { expo: id } }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
    Booth.aggregate([{ $match: { expo: id, status: 'booked' } }, { $group: { _id: null, total: { $sum: '$price' } } }]),
    Application.find({ expo: id, status: 'approved' }).select('profile').lean(),
  ]);

  const booths = await Booth.find({ expo: id }).select('code x y w h status').lean();
  const trafficMap = new Map(traffic.map((t) => [String(t._id), t.n]));
  const heat = booths.map((b) => ({ boothId: b._id, code: b.code, x: b.x, y: b.y, w: b.w, h: b.h, status: b.status, visits: trafficMap.get(String(b._id)) || 0 }));
  const maxVisits = Math.max(1, ...heat.map((h) => h.visits));

  const profiles = await ExhibitorProfile.find({ _id: { $in: approvedApps.map((a) => a.profile) } }).select('categories').lean();
  const catCount = {};
  profiles.forEach((p) => (p.categories?.length ? p.categories : ['Other']).forEach((c) => { catCount[c] = (catCount[c] || 0) + 1; }));

  const bs = toMap(boothStatus);
  const totalBooths = booths.length;
  const taken = (bs.booked || 0) + (bs.reserved || 0);
  const popular = [...sessions].sort((a, b) => (b.registeredCount + b.bookmarkCount) - (a.registeredCount + a.bookmarkCount));

  const engagementMap = {};
  visitsByDay.forEach((v) => { (engagementMap[v._id.d] ||= { date: v._id.d, booth: 0, exhibitor: 0, expo: 0 })[v._id.t] = v.n; });

  return {
    expo: { _id: expo._id, title: expo.title, startDate: expo.startDate, endDate: expo.endDate },
    totals: {
      attendees,
      exhibitors: approvedApps.length,
      booths: totalBooths,
      occupancy: totalBooths ? Math.round((taken / totalBooths) * 100) : 0,
      revenue: revenue[0]?.total || 0,
      sessions: sessions.length,
      sessionRegistrations: toMap(sessionTotals).registered || 0,
      sessionBookmarks: toMap(sessionTotals).bookmark || 0,
      boothVisits: traffic.reduce((s, t) => s + t.n, 0),
      inquiries: Object.values(toMap(inquiries)).reduce((s, n) => s + n, 0),
      appointments: toMap(inquiries).appointment || 0,
    },
    boothStatus: { available: bs.available || 0, reserved: bs.reserved || 0, booked: bs.booked || 0, blocked: bs.blocked || 0 },
    applications: { pending: 0, approved: 0, rejected: 0, withdrawn: 0, ...toMap(appStatus) },
    registrationsByDay: regsByDay.map((r) => ({ date: r._id, count: r.n })),
    engagementByDay: Object.values(engagementMap),
    boothTraffic: { maxVisits, heat, top: [...heat].sort((a, b) => b.visits - a.visits).slice(0, 8) },
    sessionPopularity: popular.slice(0, 8).map((s) => ({ _id: s._id, title: s.title, type: s.type, registered: s.registeredCount, bookmarked: s.bookmarkCount, capacity: s.capacity })),
    categories: Object.entries(catCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    generatedAt: new Date(),
  };
}

export const expoAnalytics = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.id, req.user);
  res.json({ success: true, data: await buildExpoAnalytics(expo) });
});

/** Cross-expo summary for the organizer dashboard header. */
export const overview = asyncHandler(async (req, res) => {
  const expos = await Expo.find({ organizer: req.user._id }).select('_id status').lean();
  const ids = expos.map((e) => e._id);
  const [attendees, pendingApps, openTickets, revenue, booths] = await Promise.all([
    ExpoRegistration.countDocuments({ expo: { $in: ids } }),
    Application.countDocuments({ expo: { $in: ids }, status: 'pending' }),
    Ticket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    Booth.aggregate([{ $match: { expo: { $in: ids }, status: 'booked' } }, { $group: { _id: null, total: { $sum: '$price' }, n: { $sum: 1 } } }]),
    Booth.aggregate([{ $match: { expo: { $in: ids } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const bs = toMap(booths);
  const totalBooths = Object.values(bs).reduce((s, n) => s + n, 0);
  res.json({
    success: true,
    data: {
      expos: expos.length,
      activeExpos: expos.filter((e) => ['published', 'ongoing'].includes(e.status)).length,
      attendees, pendingApplications: pendingApps, openTickets,
      revenue: revenue[0]?.total || 0,
      bookedBooths: revenue[0]?.n || 0,
      occupancy: totalBooths ? Math.round((((bs.booked || 0) + (bs.reserved || 0)) / totalBooths) * 100) : 0,
    },
  });
});

const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cells) => cells.map(csvCell).join(',');

export const exportReport = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.id, req.user);
  const a = await buildExpoAnalytics(expo);
  const lines = [
    csvRow(['EventSphere report', expo.title]), csvRow(['Generated', a.generatedAt.toISOString()]), '',
    csvRow(['Summary']), ...Object.entries(a.totals).map(([k, v]) => csvRow([k, v])), '',
    csvRow(['Booth status']), ...Object.entries(a.boothStatus).map(([k, v]) => csvRow([k, v])), '',
    csvRow(['Applications']), ...Object.entries(a.applications).map(([k, v]) => csvRow([k, v])), '',
    csvRow(['Booth traffic']), csvRow(['Booth', 'Status', 'Visits']), ...a.boothTraffic.heat.sort((x, y) => y.visits - x.visits).map((h) => csvRow([h.code, h.status, h.visits])), '',
    csvRow(['Session popularity']), csvRow(['Session', 'Type', 'Registered', 'Bookmarked', 'Capacity']), ...a.sessionPopularity.map((s) => csvRow([s.title, s.type, s.registered, s.bookmarked, s.capacity || 'unlimited'])), '',
    csvRow(['Registrations by day']), csvRow(['Date', 'Registrations']), ...a.registrationsByDay.map((r) => csvRow([r.date, r.count])),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="eventsphere-report-${expo._id}.csv"`);
  res.send(`﻿${lines.join('\r\n')}`);
});
