/**
 * Demo data for EventSphere. Usage:
 *   npm run seed            (aborts if the database already has users)
 *   npm run seed -- --force (wipes all EventSphere collections first)
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import * as M from '../models/index.js';

const force = process.argv.includes('--force');
const DAY = 86_400_000;
const HOUR = 3_600_000;
const now = Date.now();
const rnd = (n) => Math.floor(Math.random() * n);
const pickOne = (arr) => arr[rnd(arr.length)];

export const CREDENTIALS = {
  organizer: { email: 'admin@eventsphere.com', password: 'Admin@123' },
  exhibitor: { email: 'exhibitor@eventsphere.com', password: 'Exhibitor@123' },
  exhibitor2: { email: 'exhibitor2@eventsphere.com', password: 'Exhibitor@123' },
  attendee: { email: 'attendee@eventsphere.com', password: 'Attendee@123' },
};

const COMPANIES = [
  { key: 'exhibitor', name: 'TechNova Solutions', person: 'Maya Patel', cat: ['Technology'], tag: 'Cloud-native platforms for modern enterprises', products: ['NovaCloud Platform', 'NovaSecure Gateway', 'DataLens Analytics'], booth: 'A6', status: 'booked' },
  { key: 'exhibitor2', name: 'Helix MedTech', person: 'Daniel Brooks', cat: ['Healthcare'], tag: 'Smart diagnostics at the point of care', products: ['HelixScan Portable', 'VitalTrack Wearable'], booth: null, status: 'approved' },
  { name: 'GreenGrid Energy', person: 'Sofia Alvarez', cat: ['Energy'], tag: 'Clean power, delivered', products: ['SolarMax Panels', 'GridStore Battery'], booth: 'A2', status: 'booked' },
  { name: 'FreshFork Foods', person: 'Liam O\'Connor', cat: ['Food & Beverage'], tag: 'Farm-to-fork supply for hospitality', products: ['Organic Produce Boxes', 'ColdChain Logistics'], booth: 'A11', status: 'booked' },
  { name: 'Quantum Finance', person: 'Priya Nair', cat: ['Finance', 'Technology'], tag: 'Payments infrastructure for the next billion', products: ['QPay Gateway', 'RiskShield AI'], booth: 'B3', status: 'booked' },
  { name: 'EduSpark Labs', person: 'Tom Becker', cat: ['Education', 'Technology'], tag: 'Learning platforms that adapt to every student', products: ['SparkLMS', 'ClassroomVR Kit'], booth: 'B9', status: 'booked' },
  { name: 'AutoDrive Motors', person: 'Hannah Kim', cat: ['Automotive'], tag: 'Electric mobility for cities', products: ['Volt City EV', 'ChargeHub Stations'], booth: 'B14', status: 'booked' },
  { name: 'PixelCraft Studio', person: 'Omar Haddad', cat: ['Media & Design'], tag: 'Brand experiences that people remember', products: ['Immersive Displays', 'Booth Design Service'], booth: 'A15', status: 'reserved' },
  { name: 'RetailWave', person: 'Chloe Martin', cat: ['Retail', 'Technology'], tag: 'Unified commerce for modern retailers', products: ['WavePOS', 'Shelf Insight Sensors'], booth: null, status: 'pending' },
  { name: 'ForgeWorks Manufacturing', person: 'Ian Walker', cat: ['Manufacturing'], tag: 'Precision parts at industrial scale', products: ['CNC Prototyping', 'Smart Factory Kit'], booth: null, status: 'pending' },
  { name: 'ShadyDeals Ltd', person: 'Victor Hale', cat: ['Other'], tag: 'Discount everything', products: ['Assorted goods'], booth: null, status: 'rejected' },
];

const FIRST = ['Ava', 'Noah', 'Emma', 'Liam', 'Olivia', 'Ethan', 'Mia', 'Lucas', 'Zoe', 'Mason', 'Ella', 'Logan', 'Aria', 'Elijah', 'Nora', 'James', 'Layla', 'Henry', 'Ruby', 'Jack', 'Iris', 'Leo', 'Maya', 'Owen'];
const LAST = ['Smith', 'Khan', 'Garcia', 'Chen', 'Silva', 'Novak', 'Ibrahim', 'Rossi', 'Tanaka', 'Murphy', 'Singh', 'Costa', 'Weber', 'Ali', 'Lopez'];

const SPEAKERS = [
  { name: 'Dr. Elena Marković', title: 'Chief Scientist', company: 'Orbital AI', bio: 'Researcher in applied machine learning and responsible AI.' },
  { name: 'Marcus Webb', title: 'CEO', company: 'Webb Ventures', bio: 'Serial founder and early-stage investor.' },
  { name: 'Aisha Rahman', title: 'VP Engineering', company: 'CloudForge', bio: 'Builds platforms that scale to millions of users.' },
  { name: 'Carlos Mendes', title: 'Head of Sustainability', company: 'Terra Group', bio: 'Leads decarbonization programs across 30 countries.' },
  { name: 'Yuki Tanaka', title: 'Design Director', company: 'Studio Kōdo', bio: 'Designs products used by tens of millions.' },
  { name: 'Prof. Hannah Lindqvist', title: 'Professor of Health Informatics', company: 'KTH', bio: 'Specialises in digital health systems.' },
];

async function wipe() {
  await Promise.all(Object.values(M).filter((m) => m?.collection).map((m) => m.deleteMany({})));
}

async function main() {
  await connectDB();
  if (await M.User.exists({})) {
    if (!force) {
      console.error('Database already contains data. Re-run with --force to wipe and re-seed.');
      process.exitCode = 1;
      return disconnectDB();
    }
    await wipe();
  }
  await Promise.all(Object.values(M).filter((m) => m?.syncIndexes).map((m) => m.syncIndexes()));

  const hash = (pw) => bcrypt.hash(pw, 12);
  const [adminPw, exPw, atPw] = await Promise.all([hash(CREDENTIALS.organizer.password), hash(CREDENTIALS.exhibitor.password), hash(CREDENTIALS.attendee.password)]);
  const consentAt = new Date();

  // ---------- Users ----------
  const admin = await M.User.collection.insertOne({ name: 'Olivia Reed', email: CREDENTIALS.organizer.email, password: adminPw, role: 'admin', company: 'EventSphere Management', isActive: true, consentAt, createdAt: new Date(now - 60 * DAY), updatedAt: new Date() }).then((r) => r.insertedId);

  const exhibitorDocs = COMPANIES.map((c, i) => ({
    _id: new mongoose.Types.ObjectId(), name: c.person, email: c.key ? CREDENTIALS[c.key].email : `contact${i}@${c.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
    password: exPw, role: 'exhibitor', company: c.name, isActive: true, consentAt, createdAt: new Date(now - (40 - i) * DAY), updatedAt: new Date(),
  }));
  const attendeeDocs = [{ name: 'Alex Morgan', email: CREDENTIALS.attendee.email }].concat(
    Array.from({ length: 28 }, (_, i) => ({ name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`, email: `guest${i + 1}@example.com` }))
  ).map((a, i) => ({ _id: new mongoose.Types.ObjectId(), ...a, password: atPw, role: 'attendee', isActive: true, consentAt, createdAt: new Date(now - (30 - (i % 30)) * DAY), updatedAt: new Date() }));
  await M.User.collection.insertMany([...exhibitorDocs, ...attendeeDocs]);
  const attendees = attendeeDocs.map((a) => a._id);

  // ---------- Exhibitor profiles ----------
  const profiles = await M.ExhibitorProfile.insertMany(COMPANIES.map((c, i) => ({
    user: exhibitorDocs[i]._id, companyName: c.name, tagline: c.tag, categories: c.cat,
    description: `${c.name} ${c.tag.toLowerCase()}. We partner with organisations worldwide and bring our latest innovations to EventSphere expos — come and see live demos at our booth.`,
    website: `https://www.${c.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
    contact: { email: exhibitorDocs[i].email, phone: `+1 555 01${String(i).padStart(2, '0')}`, address: `${10 + i} Innovation Way` },
    products: c.products.map((p) => ({ name: p, description: `${p} — designed for reliability, speed and ease of use.` })),
    staff: [{ name: c.person, role: 'Account Director', email: exhibitorDocs[i].email, phone: '+1 555 0100' }, { name: `${pickOne(FIRST)} ${pickOne(LAST)}`, role: 'Product Specialist', email: `team@${c.name.toLowerCase().replace(/[^a-z]/g, '')}.com` }],
  })));

  // ---------- Expos ----------
  const [expo1, expo2, expo3, expo4] = await M.Expo.insertMany([
    { title: 'Global Tech Expo 2026', theme: 'Building the Intelligent Future', description: 'Three days of product launches, keynotes and hands-on workshops covering AI, cloud, fintech and sustainable technology. Meet 150+ exhibitors and thousands of industry peers.', startDate: new Date(now + 14 * DAY), endDate: new Date(now + 16 * DAY), location: { venue: 'Metro Convention Center', address: '1 Expo Boulevard', city: 'Singapore', country: 'Singapore' }, categories: ['Technology', 'Finance', 'Energy', 'Education'], status: 'published', featured: true, capacity: 5000, floorPlan: { cols: 24, rows: 14 }, organizer: admin },
    { title: 'Healthcare Innovation Summit', theme: 'Care, Connected', description: 'Where clinicians, startups and health systems meet to shape digital healthcare.', startDate: new Date(now + 60 * DAY), endDate: new Date(now + 62 * DAY), location: { venue: 'Riverside Hall', city: 'London', country: 'United Kingdom' }, categories: ['Healthcare', 'Technology'], status: 'published', capacity: 2500, floorPlan: { cols: 20, rows: 12 }, organizer: admin },
    { title: 'Sustainable Energy Fair', theme: 'Power the Planet', description: 'Renewables, storage and grid innovation under one roof.', startDate: new Date(now + 120 * DAY), endDate: new Date(now + 122 * DAY), location: { venue: 'Harbour Arena', city: 'Rotterdam', country: 'Netherlands' }, categories: ['Energy', 'Manufacturing'], status: 'draft', capacity: 3000, floorPlan: { cols: 24, rows: 14 }, organizer: admin },
    { title: 'Retail Futures 2026', theme: 'Commerce Without Limits', description: 'A look back at last year\'s retail innovation showcase.', startDate: new Date(now - 200 * DAY), endDate: new Date(now - 198 * DAY), location: { venue: 'Grand Exhibition Hall', city: 'Dubai', country: 'UAE' }, categories: ['Retail'], status: 'completed', capacity: 2000, floorPlan: { cols: 16, rows: 10 }, organizer: admin },
  ]);

  // ---------- Booths (Expo 1: two halls of 2x8 booths) ----------
  const boothDocs = [];
  const zones = [{ zone: 'Hall A', prefix: 'A', rowStart: 0, size: 'large', price: 4500 }, { zone: 'Hall B', prefix: 'B', rowStart: 2, size: 'small', price: 2500 }];
  zones.forEach((z) => {
    let n = 0;
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        n += 1;
        const mid = c === 3 || c === 4;
        boothDocs.push({ expo: expo1._id, code: `${z.prefix}${n}`, zone: z.zone, x: 1 + c * 3, y: 1 + (z.rowStart + r) * 3, w: 2, h: 2, size: r === 0 && mid ? 'large' : z.size === 'large' ? 'medium' : 'small', price: z.price + (r === 0 && mid ? 1500 : 0) });
      }
    }
  });
  boothDocs.find((b) => b.code === 'B7').status = 'blocked'; // e.g. reserved for sponsor signage
  boothDocs.find((b) => b.code === 'A8').status = 'blocked';
  // Smaller hall for expo 2
  for (let r = 0; r < 2; r += 1) for (let c = 0; c < 6; c += 1) boothDocs.push({ expo: expo2._id, code: `H${r * 6 + c + 1}`, zone: 'Main Hall', x: 1 + c * 3, y: 1 + r * 3, w: 2, h: 2, size: 'small', price: 2000 });

  const applications = [];
  COMPANIES.forEach((c, i) => {
    applications.push({ expo: expo1._id, exhibitor: exhibitorDocs[i]._id, profile: profiles[i]._id, status: c.status === 'booked' || c.status === 'reserved' ? 'approved' : c.status, productsServices: c.products.join(', '), message: 'We would love to showcase our latest products to your audience.', reviewedBy: c.status === 'pending' ? undefined : admin, reviewedAt: c.status === 'pending' ? undefined : new Date(now - 5 * DAY), rejectionReason: c.status === 'rejected' ? 'Product category does not match the expo programme.' : undefined, preferredBoothSize: 'any' });
  });
  applications.push({ expo: expo2._id, exhibitor: exhibitorDocs[1]._id, profile: profiles[1]._id, status: 'approved', productsServices: 'HelixScan Portable', reviewedBy: admin, reviewedAt: new Date() });
  const apps = await M.Application.insertMany(applications);

  COMPANIES.forEach((c, i) => {
    if (!c.booth) return;
    const b = boothDocs.find((x) => String(x.expo) === String(expo1._id) && x.code === c.booth);
    Object.assign(b, { status: c.status, exhibitor: exhibitorDocs[i]._id, application: apps[i]._id, reservedAt: new Date(now - 4 * DAY), showcase: { tagline: c.tag, description: `Visit us at booth ${c.booth} for live demos of ${c.products[0]}.`, products: c.products } });
  });
  const booths = await M.Booth.insertMany(boothDocs);
  const expo1Booths = booths.filter((b) => String(b.expo) === String(expo1._id));

  // ---------- Sessions (Expo 1) ----------
  const base = new Date(expo1.startDate); base.setUTCHours(9, 0, 0, 0);
  const at = (day, h, m = 0) => new Date(base.getTime() + day * DAY + (h - 9) * HOUR + m * 60000);
  const S = (i) => SPEAKERS[i % SPEAKERS.length];
  const sessionData = [
    [0, 9, 0, 60, 'Opening Keynote: Intelligent Futures', 'keynote', 'Main Stage', 'Strategy', [S(0)], 0],
    [0, 10, 30, 45, 'Scaling Cloud Platforms Without the Pain', 'talk', 'Main Stage', 'Cloud', [S(2)], 0],
    [0, 11, 30, 90, 'Workshop: Building Your First AI Agent', 'workshop', 'Workshop Room A', 'AI', [S(0), S(2)], 30],
    [0, 13, 30, 60, 'Panel: The Future of Payments', 'panel', 'Panel Hall', 'Fintech', [S(1), S(4)], 120],
    [0, 15, 0, 45, 'Design That Ships: Lessons from 10 Years', 'talk', 'Main Stage', 'Design', [S(4)], 0],
    [1, 9, 30, 60, 'Keynote: Capital in the Age of AI', 'keynote', 'Main Stage', 'Strategy', [S(1)], 0],
    [1, 11, 0, 60, 'Decarbonizing Tech Infrastructure', 'talk', 'Panel Hall', 'Sustainability', [S(3)], 80],
    [1, 11, 0, 120, 'Workshop: Secure-by-Design APIs', 'workshop', 'Workshop Room B', 'Security', [S(2)], 25],
    [1, 14, 0, 60, 'Panel: Digital Health Meets Enterprise Tech', 'panel', 'Panel Hall', 'Healthcare', [S(5), S(0)], 80],
    [1, 16, 0, 60, 'Networking Mixer', 'networking', 'Expo Floor Lounge', 'Networking', [], 0],
    [2, 10, 0, 60, 'Keynote: Building Products People Love', 'keynote', 'Main Stage', 'Design', [S(4)], 0],
    [2, 12, 0, 90, 'Workshop: Data Storytelling', 'workshop', 'Workshop Room A', 'Data', [S(0)], 30],
    [2, 14, 30, 45, 'Closing Remarks & Awards', 'talk', 'Main Stage', 'Strategy', [S(1)], 0],
  ].map(([d, h, m, len, title, type, location, topic, speakers, capacity]) => ({
    expo: expo1._id, title, type, location, topic, speakers, capacity, startTime: at(d, h, m), endTime: new Date(at(d, h, m).getTime() + len * 60000),
    description: `${title} — a session at Global Tech Expo 2026 presented by industry leaders. Includes Q&A.`,
  }));
  const sessions = await M.Session.insertMany(sessionData);

  // ---------- Attendee engagement ----------
  const regDocs = attendees.map((u, i) => { const d = new Date(now - (24 - Math.floor(i * 0.8)) * DAY - rnd(20) * HOUR); return { user: u, expo: expo1._id, createdAt: d, updatedAt: d }; });
  attendees.slice(0, 10).forEach((u) => { const d = new Date(now - rnd(10) * DAY); regDocs.push({ user: u, expo: expo2._id, createdAt: d, updatedAt: d }); });
  await M.ExpoRegistration.collection.insertMany(regDocs);

  const regs = [];
  const counts = new Map();
  attendees.forEach((u, ai) => {
    const take = new Set(); const n = 2 + rnd(4);
    while (take.size < n) take.add(rnd(sessions.length));
    [...take].forEach((si) => {
      const s = sessions[si];
      const kind = ai === 0 ? (si % 2 ? 'registered' : 'bookmark') : (rnd(10) < 6 ? 'registered' : 'bookmark');
      const full = kind === 'registered' && s.capacity > 0 && (counts.get(`${si}r`) || 0) >= s.capacity;
      const k = full ? 'bookmark' : kind;
      counts.set(`${si}${k[0]}`, (counts.get(`${si}${k[0]}`) || 0) + 1);
      regs.push({ user: u, session: s._id, expo: expo1._id, kind: k, reminderMinutes: 15, remindAt: new Date(s.startTime.getTime() - 15 * 60000), reminderSent: false });
    });
  });
  await M.SessionRegistration.insertMany(regs);
  await Promise.all(sessions.map((s, si) => M.Session.updateOne({ _id: s._id }, { registeredCount: counts.get(`${si}r`) || 0, bookmarkCount: counts.get(`${si}b`) || 0 })));

  const booked = expo1Booths.filter((b) => b.status === 'booked');
  const visits = [];
  for (let i = 0; i < 520; i += 1) {
    const weighted = rnd(10) < 7 ? booked : expo1Booths;
    visits.push({ expo: expo1._id, type: 'booth', booth: pickOne(weighted)._id, user: pickOne(attendees), at: new Date(now - rnd(14 * 24) * HOUR) });
  }
  for (let i = 0; i < 200; i += 1) visits.push({ expo: expo1._id, type: 'expo', user: pickOne(attendees), at: new Date(now - rnd(14 * 24) * HOUR) });
  await M.Visit.insertMany(visits);

  // ---------- Inquiries, tickets, messaging, feedback, notifications ----------
  const demoEx = exhibitorDocs[0]._id;
  await M.Inquiry.insertMany([
    { expo: expo1._id, attendee: attendees[0], exhibitor: demoEx, type: 'appointment', subject: 'Demo of NovaCloud Platform', appointmentAt: new Date(expo1.startDate.getTime() + 10 * HOUR), status: 'pending', messages: [{ sender: attendees[0], body: 'Hi! We are evaluating cloud platforms for our retail business. Could we book a 30 minute demo on day one?' }] },
    { expo: expo1._id, attendee: attendees[1], exhibitor: demoEx, type: 'inquiry', subject: 'Pricing for DataLens Analytics', status: 'accepted', messages: [{ sender: attendees[1], body: 'Do you offer a startup plan for DataLens?' }, { sender: demoEx, body: 'Yes! We have a startup tier starting at $49/month. I will bring the brochure to the booth.' }] },
    { expo: expo1._id, attendee: attendees[0], exhibitor: exhibitorDocs[2]._id, type: 'inquiry', subject: 'Commercial solar installation', status: 'pending', messages: [{ sender: attendees[0], body: 'Can you share case studies for 500kW rooftop installations?' }] },
  ]);
  await M.Ticket.insertMany([
    { exhibitor: demoEx, expo: expo1._id, subject: 'Need extra power outlets at booth A6', category: 'booth', priority: 'medium', status: 'in_progress', assignedTo: admin, messages: [{ sender: demoEx, body: 'We are running two large demo screens. Can we get two additional power outlets?' }, { sender: admin, body: 'Hi! We have noted this request and will confirm with the venue electricians.' }] },
    { exhibitor: exhibitorDocs[3]._id, expo: expo1._id, subject: 'Cold storage requirements', category: 'technical', priority: 'high', status: 'open', messages: [{ sender: exhibitorDocs[3]._id, body: 'We will need access to a refrigerated area for sampling. Is that available?' }] },
  ]);
  const key = [String(demoEx), String(exhibitorDocs[2]._id)].sort().join(':');
  const convo = await M.Conversation.create({ participants: [demoEx, exhibitorDocs[2]._id], pairKey: key, lastMessage: 'Great, let us catch up at the expo!', lastAt: new Date(), unread: { [String(demoEx)]: 1 } });
  await M.Message.insertMany([
    { conversation: convo._id, sender: demoEx, body: 'Hi Sofia, we are neighbours at the expo! Would love to explore a collaboration around smart energy dashboards.' },
    { conversation: convo._id, sender: exhibitorDocs[2]._id, body: 'Great, let us catch up at the expo!' },
  ]);
  await M.Feedback.insertMany([
    { user: attendees[0], type: 'suggestion', message: 'It would be great to see a map filter for session rooms.', rating: 5 },
    { user: attendees[2], type: 'issue', message: 'The reminder time was not what I selected on mobile.', rating: 3 },
    { user: demoEx, type: 'other', message: 'Smooth booth reservation process. Thank you!', rating: 5 },
  ]);
  await M.Notification.insertMany([
    { user: demoEx, type: 'application', title: 'Application approved - Global Tech Expo 2026', body: 'You can now choose and reserve your booth on the floor plan.', link: '/exhibitor/booths' },
    { user: demoEx, type: 'inquiry', title: 'Appointment request from Alex Morgan', body: 'Demo of NovaCloud Platform', link: '/exhibitor/inquiries' },
    { user: attendees[0], type: 'expo', title: "You're registered for Global Tech Expo 2026", body: 'Browse the schedule and bookmark the sessions you want to attend.', link: `/attendee/expos/${expo1._id}` },
    { user: admin, type: 'application', title: 'New exhibitor application', body: 'RetailWave applied to Global Tech Expo 2026.', link: '/admin/applications' },
    { user: admin, type: 'ticket', title: 'New support ticket: Cold storage requirements', body: 'FreshFork Foods - high priority', link: '/admin/support' },
  ]);

  console.log('\nSeed complete.\n');
  console.table(Object.entries(CREDENTIALS).map(([role, c]) => ({ account: role, email: c.email, password: c.password })));
  console.log(`Expos: ${[expo1, expo2, expo3, expo4].map((e) => e.title).join(' | ')}`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
