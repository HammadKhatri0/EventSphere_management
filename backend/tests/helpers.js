import { MongoMemoryServer } from 'mongodb-memory-server';

// Must be set before the app (and its env validation) is imported.
Object.assign(process.env, {
  NODE_ENV: 'test',
  mongo_uri: 'mongodb://placeholder',
  JWT_ACCESS_SECRET: 'test_access_secret_0123456789abcdef0123456789',
  JWT_REFRESH_SECRET: 'test_refresh_secret_0123456789abcdef012345678',
  ORGANIZER_INVITE_CODE: 'TEST-ORG-CODE',
  CLIENT_URL: 'http://localhost:5173',
  CLOUD_NAME: '', CLOUD_API_KEY: '', CLOUD_API_SECRET: '',
});

export async function startTestApp() {
  const mongod = await MongoMemoryServer.create();
  const { connectDB, disconnectDB } = await import('../src/config/db.js');
  const { createApp } = await import('../src/app.js');
  const models = await import('../src/models/index.js');
  const { default: supertest } = await import('supertest');
  await connectDB(mongod.getUri());
  await Promise.all(Object.values(models).filter((m) => m?.syncIndexes).map((m) => m.syncIndexes()));
  const app = createApp();
  return {
    request: () => supertest(app),
    agent: () => supertest.agent(app),
    models,
    stop: async () => { await disconnectDB(); await mongod.stop(); },
  };
}

let counter = 0;
/** Registers a user and returns { token, user, auth() } */
export async function signup(ctx, role, extra = {}) {
  counter += 1;
  const body = {
    name: `Test ${role} ${counter}`, email: `${role}${counter}@test.com`, password: 'Passw0rdTest', role,
    consent: true, ...(role === 'exhibitor' ? { company: `Company ${counter}` } : {}), ...(role === 'admin' ? { organizerCode: 'TEST-ORG-CODE' } : {}), ...extra,
  };
  const res = await ctx.request().post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  const token = res.body.data.accessToken;
  return { token, user: res.body.data.user, body, auth: (req) => req.set('Authorization', `Bearer ${token}`) };
}
