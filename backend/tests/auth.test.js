import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, signup } from './helpers.js';

let ctx;
before(async () => { ctx = await startTestApp(); });
after(async () => { await ctx.stop(); });

test('registers users with roles and never returns the password', async () => {
  const a = await signup(ctx, 'attendee');
  assert.equal(a.user.role, 'attendee');
  assert.equal(a.user.password, undefined);
  const ex = await signup(ctx, 'exhibitor');
  assert.equal(ex.user.role, 'exhibitor');
  assert.ok(await ctx.models.ExhibitorProfile.exists({ user: ex.user._id }), 'exhibitor profile is created');
});

test('organizer registration requires the invite code', async () => {
  const res = await ctx.request().post('/api/auth/register').send({ name: 'Org', email: 'org@test.com', password: 'Passw0rdTest', role: 'admin', consent: true });
  assert.equal(res.status, 403);
  const ok = await signup(ctx, 'admin');
  assert.equal(ok.user.role, 'admin');
});

test('rejects weak passwords, missing consent and duplicate emails', async () => {
  const weak = await ctx.request().post('/api/auth/register').send({ name: 'X', email: 'weak@test.com', password: 'short', consent: true });
  assert.equal(weak.status, 400);
  const noConsent = await ctx.request().post('/api/auth/register').send({ name: 'X', email: 'nc@test.com', password: 'Passw0rdTest', consent: false });
  assert.equal(noConsent.status, 400);
  const a = await signup(ctx, 'attendee');
  const dup = await ctx.request().post('/api/auth/register').send({ ...a.body });
  assert.equal(dup.status, 409);
});

test('login validates credentials and portal role', async () => {
  const a = await signup(ctx, 'attendee');
  const bad = await ctx.request().post('/api/auth/login').send({ email: a.body.email, password: 'WrongPass1' });
  assert.equal(bad.status, 401);
  const wrongPortal = await ctx.request().post('/api/auth/login').send({ email: a.body.email, password: a.body.password, role: 'admin' });
  assert.equal(wrongPortal.status, 403);
  const ok = await ctx.request().post('/api/auth/login').send({ email: a.body.email, password: a.body.password, role: 'attendee' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.data.accessToken);
});

test('blocks NoSQL operator injection in credentials', async () => {
  const res = await ctx.request().post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
  assert.equal(res.status, 400);
});

test('protected routes need a valid token', async () => {
  assert.equal((await ctx.request().get('/api/auth/me')).status, 401);
  assert.equal((await ctx.request().get('/api/auth/me').set('Authorization', 'Bearer garbage')).status, 401);
});

test('refresh tokens rotate and a reused token is rejected', async () => {
  const agent = ctx.agent();
  const a = await signup(ctx, 'attendee');
  const login = await agent.post('/api/auth/login').send({ email: a.body.email, password: a.body.password });
  const cookie = login.headers['set-cookie'].find((c) => c.startsWith('es_refresh='));
  assert.match(cookie, /HttpOnly/i);
  const first = await agent.post('/api/auth/refresh');
  assert.equal(first.status, 200);
  const replay = await ctx.request().post('/api/auth/refresh').set('Cookie', cookie.split(';')[0]);
  assert.equal(replay.status, 401);
  await agent.post('/api/auth/logout');
  assert.equal((await agent.post('/api/auth/refresh')).status, 401);
});

test('account locks after repeated failed logins', async () => {
  const a = await signup(ctx, 'attendee');
  for (let i = 0; i < 5; i += 1) await ctx.request().post('/api/auth/login').send({ email: a.body.email, password: 'WrongPass1' });
  const locked = await ctx.request().post('/api/auth/login').send({ email: a.body.email, password: a.body.password });
  assert.equal(locked.status, 423);
});

test('password reset flow works once and invalidates old sessions', async () => {
  const a = await signup(ctx, 'attendee');
  const forgot = await ctx.request().post('/api/auth/forgot-password').send({ email: a.body.email });
  assert.equal(forgot.status, 200);
  const token = new URL(forgot.body.devResetUrl).searchParams.get('token');
  const reset = await ctx.request().post('/api/auth/reset-password').send({ token, password: 'NewPassw0rd1' });
  assert.equal(reset.status, 200);
  assert.equal((await ctx.request().post('/api/auth/reset-password').send({ token, password: 'AnotherPass1' })).status, 400);
  assert.equal((await ctx.request().post('/api/auth/login').send({ email: a.body.email, password: 'NewPassw0rd1' })).status, 200);
  const unknown = await ctx.request().post('/api/auth/forgot-password').send({ email: 'nobody@test.com' });
  assert.equal(unknown.status, 200, 'does not reveal whether the email exists');
  assert.equal(unknown.body.devResetUrl, undefined);
});
