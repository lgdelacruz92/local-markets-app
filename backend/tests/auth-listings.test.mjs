import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import request from '../auth/node_modules/supertest/index.js';
import { createAuthApp } from '../auth/dist/app.js';
import { createApp } from '../listings/dist/app.js';

// Build both services first. Exercises real inter-service HTTP, with only OAuth mocked.
test('listings validates auth-service identity/CSRF and rejects logged-out or tampered sessions', async (t) => {
  const provider = {
    async authorize(state) { return `https://provider.example/?state=${state}`; },
    async authenticate() { return { id: 'google:fixture', displayName: 'Fixture User' }; },
  };
  const auth = createAuthApp({
    sessionSecret: 'integration-fixture-secret-never-for-deployment', appUrl: 'http://localhost:3000/',
    secureCookies: false, trustProxy: false,
    providers: { google: { clientId: 'fixture', clientSecret: 'fixture', callbackUrl: 'http://localhost:3000/api/auth/google/callback' } },
  }, { clients: { google: provider } });
  const server = auth.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const listings = createApp({ async browse() { return []; }, async findById() { return undefined; } }, `http://127.0.0.1:${server.address().port}`);
  const agent = request.agent(auth);
  const start = await agent.get('/api/auth/google/start').expect(302);
  const state = new URL(start.headers.location).searchParams.get('state');
  const callback = await agent.get('/api/auth/google/callback').query({ state, code: 'fixture' }).expect(302);
  const cookie = callback.headers['set-cookie'][0].split(';')[0];
  const session = await agent.get('/api/session').expect(200);
  assert.deepEqual(session.body.user, { id: 'google:fixture', displayName: 'Fixture User' });
  await request(listings).post('/api/listings').expect(401);
  await request(listings).post('/api/listings').set('Cookie', 'market.sid=tampered').set('X-CSRF-Token', session.body.csrfToken).expect(401);
  await request(listings).post('/api/listings').set('Cookie', cookie).expect(403);
  await request(listings).post('/api/listings').set('Cookie', cookie).set('X-CSRF-Token', 'wrong').expect(403);
  // A valid write passes the guard and reaches the current checkout's route-not-found handler.
  const allowed = await request(listings).post('/api/listings').set('Cookie', cookie).set('X-CSRF-Token', session.body.csrfToken).expect(404);
  assert.equal(allowed.body.error.code, 'NOT_FOUND');
  await agent.post('/api/logout').set('X-CSRF-Token', session.body.csrfToken).expect(204);
  await request(listings).post('/api/listings').set('Cookie', cookie).set('X-CSRF-Token', session.body.csrfToken).expect(401);
  await request(listings).get('/api/listings').expect(200);
});
