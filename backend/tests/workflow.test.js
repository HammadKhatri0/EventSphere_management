import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, signup } from './helpers.js';

let ctx; let admin; let ex1; let ex2; let at1; let at2; let expoId; let booths;
const day = 86_400_000;

before(async () => {
  ctx = await startTestApp();
  [admin, ex1, ex2, at1, at2] = await Promise.all([signup(ctx, 'admin'), signup(ctx, 'exhibitor'), signup(ctx, 'exhibitor'), signup(ctx, 'attendee'), signup(ctx, 'attendee')]);
  const res = await admin.auth(ctx.request().post('/api/expos')).send({
    title: 'Test Expo', startDate: new Date(Date.now() + 10 * day), endDate: new Date(Date.now() + 12 * day), status: 'published',
    location: { venue: 'Hall 1', city: 'Testville' }, floorPlan: { cols: 12, rows: 8 },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  expoId = res.body.data.expo._id;
});
after(async () => { await ctx.stop(); });

test('only organizers can manage expos and booths', async () => {
  const asAttendee = await at1.auth(ctx.request().post('/api/expos')).send({});
  assert.equal(asAttendee.status, 403);
  const asExhibitor = await ex1.auth(ctx.request().post(`/api/expos/${expoId}/booths`)).send({ code: 'X1', x: 0, y: 0 });
  assert.equal(asExhibitor.status, 403);
  const anon = await ctx.request().delete(`/api/expos/${expoId}`);
  assert.equal(anon.status, 401);
});

test('floor plan: bulk generation, bounds and overlap checks', async () => {
  const bulk = await admin.auth(ctx.request().post(`/api/expos/${expoId}/booths/bulk`)).send({ rows: 2, cols: 3, prefix: 'T', price: 1000 });
  assert.equal(bulk.status, 201, JSON.stringify(bulk.body));
  assert.equal(bulk.body.data.count, 6);
  const clash = await admin.auth(ctx.request().post(`/api/expos/${expoId}/booths`)).send({ code: 'CLASH', x: 1, y: 1 });
  assert.equal(clash.status, 409);
  const outside = await admin.auth(ctx.request().post(`/api/expos/${expoId}/booths`)).send({ code: 'OUT', x: 11, y: 7 });
  assert.equal(outside.status, 400);
  const list = await ctx.request().get(`/api/expos/${expoId}/booths`);
  assert.equal(list.status, 200);
  booths = list.body.data.booths;
  assert.equal(booths.length, 6);
});

test('application approval gates booth reservation; reservation is race-free', async () => {
  const target = booths[0]._id;
  const early = await ex1.auth(ctx.request().post(`/api/expos/${expoId}/booths/${target}/reserve`));
  assert.equal(early.status, 403, 'cannot reserve before approval');

  const apps = [];
  for (const ex of [ex1, ex2]) {
    const res = await ex.auth(ctx.request().post('/api/applications')).send({ expoId, productsServices: 'Widgets' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    apps.push(res.body.data.application._id);
  }
  assert.equal((await ex1.auth(ctx.request().post('/api/applications')).send({ expoId })).status, 409, 'duplicate application');

  const noReason = await admin.auth(ctx.request().patch(`/api/applications/${apps[0]}/review`)).send({ status: 'rejected' });
  assert.equal(noReason.status, 400);
  for (const id of apps) {
    const r = await admin.auth(ctx.request().patch(`/api/applications/${id}/review`)).send({ status: 'approved' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  assert.equal((await admin.auth(ctx.request().patch(`/api/applications/${apps[0]}/review`)).send({ status: 'approved' })).status, 409, 'already reviewed');

  const results = await Promise.all([ex1, ex2].map((ex) => ex.auth(ctx.request().post(`/api/expos/${expoId}/booths/${target}/reserve`))));
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [200, 409], 'exactly one exhibitor wins the booth');

  const winner = results.findIndex((r) => r.status === 200) === 0 ? ex1 : ex2;
  const loser = winner === ex1 ? ex2 : ex1;
  assert.equal((await loser.auth(ctx.request().post(`/api/expos/${expoId}/booths/${target}/release`))).status, 403, "cannot release someone else's booth");

  const confirm = await admin.auth(ctx.request().post(`/api/expos/${expoId}/booths/${target}/confirm`));
  assert.equal(confirm.status, 200);
  const pub = await ctx.request().get(`/api/expos/${expoId}/booths`);
  const b = pub.body.data.booths.find((x) => x._id === target);
  assert.equal(b.status, 'booked');
  assert.ok(b.exhibitor.companyName, 'booked booth shows the company publicly');
  assert.equal(JSON.stringify(pub.body).includes('@test.com'), false, 'no personal data leaks in the public floor plan');

  const dir = await ctx.request().get(`/api/exhibitors/directory?expo=${expoId}`);
  assert.equal(dir.body.data.items.length, 1);
});

test('draft expos are hidden from the public', async () => {
  const draft = await admin.auth(ctx.request().post('/api/expos')).send({ title: 'Secret', startDate: new Date(Date.now() + day), endDate: new Date(Date.now() + 2 * day), location: { venue: 'X' } });
  const id = draft.body.data.expo._id;
  assert.equal((await ctx.request().get(`/api/expos/${id}`)).status, 404);
  assert.equal((await admin.auth(ctx.request().get(`/api/expos/${id}`))).status, 200);
  const list = await ctx.request().get('/api/expos');
  assert.ok(!list.body.data.items.some((e) => e._id === id));
});

test('sessions: room conflicts are rejected and capacity is never oversold', async () => {
  const start = new Date(Date.now() + 10 * day);
  const end = new Date(start.getTime() + 3600_000);
  const mk = (extra = {}) => admin.auth(ctx.request().post(`/api/expos/${expoId}/sessions`)).send({ title: 'Talk', location: 'Room 1', startTime: start, endTime: end, capacity: 1, ...extra });
  const first = await mk();
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal((await mk()).status, 409, 'same room, same time');
  const sid = first.body.data.session._id;

  const regs = await Promise.all([at1, at2].map((a) => a.auth(ctx.request().post(`/api/sessions/${sid}/register`)).send({ reminderMinutes: 15 })));
  assert.deepEqual(regs.map((r) => r.status).sort(), [201, 409]);
  const s = await ctx.models.Session.findById(sid).lean();
  assert.equal(s.registeredCount, 1);

  const mine = await at1.auth(ctx.request().post(`/api/sessions/${sid}/bookmark`)).send({});
  assert.ok([200, 201].includes(mine.status));
});

test('reminders are delivered exactly once', async () => {
  const { processReminders } = await import('../src/services/reminder.service.js');
  const user = at1.user._id;
  const session = await ctx.models.Session.create({ expo: expoId, title: 'Soon', location: 'R9', startTime: new Date(Date.now() + 10 * 60000), endTime: new Date(Date.now() + 70 * 60000) });
  await ctx.models.SessionRegistration.create({ user, session: session._id, expo: expoId, kind: 'bookmark', reminderMinutes: 15, remindAt: new Date(Date.now() - 1000) });
  assert.equal(await processReminders(), 1);
  assert.equal(await processReminders(), 0);
  assert.equal(await ctx.models.Notification.countDocuments({ user, type: 'reminder' }), 1);
});

test('data isolation: exhibitors cannot read other exhibitors tickets or inquiries', async () => {
  const t = await ex1.auth(ctx.request().post('/api/tickets')).send({ subject: 'Help', message: 'Need power' });
  assert.equal(t.status, 201);
  const id = t.body.data.ticket._id;
  assert.equal((await ex2.auth(ctx.request().get(`/api/tickets/${id}`))).status, 404);
  assert.equal((await admin.auth(ctx.request().get(`/api/tickets/${id}`))).status, 200);
  assert.equal((await at1.auth(ctx.request().get('/api/tickets'))).status, 403);
});

test('analytics are only available to the owning organizer and export CSV safely', async () => {
  const other = await signup(ctx, 'admin');
  assert.equal((await other.auth(ctx.request().get(`/api/analytics/expos/${expoId}`))).status, 403);
  const mine = await admin.auth(ctx.request().get(`/api/analytics/expos/${expoId}`));
  assert.ok([200, 201].includes(mine.status));
  assert.equal(mine.body.data.totals.booths, 6);
  const csv = await admin.auth(ctx.request().get(`/api/analytics/expos/${expoId}/report.csv`));
  assert.match(csv.headers['content-type'], /text\/csv/);
});

test('GDPR: users can export and delete their data', async () => {
  const u = await signup(ctx, 'attendee');
  const exp = await u.auth(ctx.request().get('/api/auth/me/export'));
  assert.equal(exp.status, 200);
  assert.equal(exp.body.user.email, u.body.email);
  const del = await u.auth(ctx.request().delete('/api/auth/me')).send({ password: u.body.password });
  assert.equal(del.status, 200);
  assert.equal((await ctx.request().post('/api/auth/login').send({ email: u.body.email, password: u.body.password })).status, 401);
});

test('unknown routes and malformed ids return clean errors', async () => {
  assert.equal((await ctx.request().get('/api/nope')).status, 404);
  assert.equal((await ctx.request().get('/api/expos/not-an-id')).status, 400);
  const health = await ctx.request().get('/api/health');
  assert.equal(health.status, 200);
});

test('uploads: validates file content and only accepts our own file URLs', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082', 'hex');
  const ok = await ex1.auth(ctx.request().post('/api/uploads/image')).attach('file', png, { filename: 'logo.png', contentType: 'image/png' });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.match(ok.body.data.url, /^\/uploads\/[\w.-]+\.png$/);
  const fake = await ex1.auth(ctx.request().post('/api/uploads/image')).attach('file', Buffer.from('MZ not really a png'), { filename: 'x.png', contentType: 'image/png' });
  assert.equal(fake.status, 400);
  const wrongType = await ex1.auth(ctx.request().post('/api/uploads/image')).attach('file', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' });
  assert.equal(wrongType.status, 400);
  assert.equal((await ctx.request().post('/api/uploads/image').attach('file', png, { filename: 'a.png', contentType: 'image/png' })).status, 401);
  const prof = await ex1.auth(ctx.request().put('/api/exhibitors/profile/me')).send({ companyName: 'Acme', logo: ok.body.data.url });
  assert.equal(prof.status, 200, JSON.stringify(prof.body));
  const evil = await ex1.auth(ctx.request().put('/api/exhibitors/profile/me')).send({ companyName: 'Acme', logo: 'https://evil.example/x.png' });
  assert.equal(evil.status, 400);
  const cleared = await ex1.auth(ctx.request().put('/api/exhibitors/profile/me')).send({ companyName: 'Acme', logo: '', website: '' });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
  assert.ok(!cleared.body.data.profile.logo, 'logo can be removed');
});
