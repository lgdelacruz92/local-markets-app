import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { requireSessionWrite } from '../src/auth.js';

const identity = { id: 'google:trusted', displayName: 'Trusted User' };
function fixture(body: unknown = { user: identity, csrfToken: 'fixture-csrf' }, outage = false) {
  let calls = 0;
  const fetchSession: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), 'http://auth:3001/api/session');
    assert.deepEqual(init?.headers, { Cookie: 'market.sid=fixture-cookie' });
    if (outage) throw new Error('secret internal details');
    return Response.json(body);
  };
  const app = express();
  app.use('/api/listings', requireSessionWrite('http://auth:3001', fetchSession));
  app.all('/api/listings', (_req, res) => { res.json({ user: res.locals.user ?? null }); });
  return { app, calls: () => calls };
}

test('all listings writes require session identity before CSRF', async () => {
  const { app, calls } = fixture();
  for (const method of ['post', 'patch', 'put', 'delete'] as const) {
    const result = await request(app)[method]('/api/listings').set('X-CSRF-Token', 'fixture-csrf').expect(401);
    assert.equal(result.body.error.code, 'UNAUTHENTICATED');
  }
  assert.equal(calls(), 0);
  const anonymous = fixture({ user: null, csrfToken: 'fixture-csrf' });
  await request(anonymous.app).post('/api/listings').set('Cookie', 'market.sid=fixture-cookie').expect(401);
});

test('authenticated writes reject missing, invalid and Unicode CSRF', async () => {
  const { app } = fixture();
  for (const token of [undefined, 'bad', 'é'.repeat(12)]) {
    const req = request(app).post('/api/listings').set('Cookie', 'market.sid=fixture-cookie');
    if (token) req.set('X-CSRF-Token', token);
    const result = await req.expect(403);
    assert.equal(result.body.error.code, 'INVALID_CSRF');
  }
});

test('valid CSRF exposes trusted session identity, not request identity, to write handlers', async () => {
  const { app } = fixture();
  for (const method of ['post', 'patch', 'put', 'delete'] as const) {
    const response = await request(app)[method]('/api/listings').set('Cookie', 'market.sid=fixture-cookie').set('X-CSRF-Token', 'fixture-csrf').set('X-User-Id', 'attacker').send({ seller: { id: 'attacker' } }).expect(200);
    assert.deepEqual(response.body.user, identity);
  }
});

test('session authority outage/malformed response fails closed without leaking details', async () => {
  for (const { app } of [fixture({}, false), fixture(undefined, true)]) {
    const response = await request(app).post('/api/listings').set('Cookie', 'market.sid=fixture-cookie').set('X-CSRF-Token', 'fixture-csrf').expect(503);
    assert.equal(response.body.error.code, 'AUTH_UNAVAILABLE');
    assert.equal(JSON.stringify(response.body).includes('secret'), false);
  }
});

test('public reads do not contact auth authority; unsafe auth origins fail configuration', async () => {
  const { app, calls } = fixture();
  await request(app).get('/api/listings').expect(200);
  assert.equal(calls(), 0);
  for (const url of ['file:///secret', 'http://user:secret@auth:3001', 'http://auth:3001/path']) assert.throws(() => requireSessionWrite(url));
});
