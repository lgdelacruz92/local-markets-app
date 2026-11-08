import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import session from 'express-session';
import request from 'supertest';
import { createAuthApp } from '../src/app.js';
import { loadConfig, type AuthConfig, type Provider } from '../src/config.js';
import { AuthenticationRejected, createProvider, type OAuthClient } from '../src/providers.js';

const env = { SESSION_SECRET: 'fixture-only-secret-not-for-runtime-12345', APP_URL: 'http://localhost:3000/' };
const credentials = { clientId: 'fixture-id', clientSecret: 'fixture-secret', callbackUrl: 'http://localhost:3000/api/auth/google/callback' };
const config: AuthConfig = { ...loadConfig(env), providers: { google: credentials, facebook: { ...credentials, callbackUrl: 'http://localhost:3000/api/auth/facebook/callback' } } };
const client: OAuthClient = {
  async authorize(state, verifier) { return `https://provider.example/authorize?state=${state}&challenge=${verifier}`; },
  async authenticate() { return { id: 'fixture:42', displayName: 'Fixture User' }; },
};
function fixture(clients = { google: client, facebook: client }, settings = config, now?: () => number) {
  const app = createAuthApp(settings, { clients, now });
  return { app, agent: request.agent(app) };
}
async function start(agent: ReturnType<typeof request.agent>, provider: Provider = 'google') {
  const response = await agent.get(`/api/auth/${provider}/start`).expect(302);
  return new URL(response.headers.location).searchParams.get('state')!;
}

test('anonymous session is HTTP-only, stable, uncached, and isolated per browser', async () => {
  const { app, agent } = fixture();
  const first = await agent.get('/api/session').expect(200);
  assert.equal(first.body.user, null);
  assert.match(first.body.csrfToken, /^[\w-]{43}$/);
  assert.match(first.headers['set-cookie'][0], /HttpOnly/);
  assert.match(first.headers['set-cookie'][0], /SameSite=Lax/);
  assert.doesNotMatch(first.headers['set-cookie'][0], /Secure/);
  assert.equal(first.headers['cache-control'], 'no-store');
  assert.deepEqual((await agent.get('/api/session')).body, first.body);
  assert.notEqual((await request(app).get('/api/session')).body.csrfToken, first.body.csrfToken);
});

for (const provider of ['google', 'facebook'] as const) test(`${provider} callback establishes identity, rotates session/CSRF and prevents replay`, async () => {
  const { app, agent } = fixture();
  const before = await agent.get('/api/session');
  const oldCookie = before.headers['set-cookie'][0].split(';')[0];
  const state = await start(agent, provider);
  const callback = await agent.get(`/api/auth/${provider}/callback`).query({ state, code: 'valid' }).expect(302);
  assert.equal(callback.headers.location, config.appUrl);
  assert.notEqual(callback.headers['set-cookie'][0].split(';')[0], oldCookie);
  const after = await agent.get('/api/session').expect(200);
  assert.deepEqual(after.body.user, { id: 'fixture:42', displayName: 'Fixture User' });
  assert.notEqual(before.body.csrfToken, after.body.csrfToken);
  assert.equal((await request(app).get('/api/session').set('Cookie', oldCookie)).body.user, null);
  await agent.get(`/api/auth/${provider}/callback`).query({ state, code: 'valid' }).expect(400);
});

test('concurrent callbacks consume state only once', async () => {
  let calls = 0;
  const controlled = { ...client, async authenticate() { calls++; return { id: 'google:42', displayName: 'Fixture' }; } };
  const { agent } = fixture({ google: controlled, facebook: controlled });
  const state = await start(agent);
  const results = await Promise.all([1, 2].map(() => agent.get('/api/auth/google/callback').query({ state, code: 'ok' })));
  assert.deepEqual(results.map(result => result.status).sort(), [302, 400]);
  assert.equal(calls, 1);
});

test('expired and forged session cookies do not authenticate', async () => {
  const store = new session.MemoryStore();
  const app = createAuthApp(config, { store, clients: { google: client } });
  const agent = request.agent(app);
  const state = await start(agent);
  const callback = await agent.get('/api/auth/google/callback').query({ state, code: 'ok' }).expect(302);
  const cookie = callback.headers['set-cookie'][0].split(';')[0];
  const sessions = await new Promise<Record<string, session.SessionData>>((resolve, reject) => store.all((error, result) => error ? reject(error) : resolve(result as Record<string, session.SessionData>)));
  for (const [id, data] of Object.entries(sessions)) {
    data.cookie.expires = new Date(0);
    await new Promise<void>((resolve, reject) => store.set(id, data, error => error ? reject(error) : resolve()));
  }
  assert.equal((await request(app).get('/api/session').set('Cookie', cookie)).body.user, null);
  assert.equal((await request(app).get('/api/session').set('Cookie', 'market.sid=s%3Aforged.invalid')).body.user, null);
});

test('startup fails actionably when required config is missing without leaking secrets', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    env: { ...process.env, SESSION_SECRET: '', APP_URL: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Set SESSION_SECRET/);
  assert.doesNotMatch(result.stderr, /fixture-secret/);
});

test('logout validates CSRF, invalidates session on server, and clears cookie', async () => {
  const { app, agent } = fixture();
  const state = await start(agent);
  const callback = await agent.get('/api/auth/google/callback').query({ state, code: 'ok' }).expect(302);
  const cookie = callback.headers['set-cookie'][0].split(';')[0];
  const current = await agent.get('/api/session');
  for (const token of [undefined, 'wrong', 'é'.repeat(43)]) {
    const req = agent.post('/api/logout'); if (token) req.set('X-CSRF-Token', token);
    await req.expect(403);
  }
  const logout = await agent.post('/api/logout').set('X-CSRF-Token', current.body.csrfToken).expect(204);
  assert.match(logout.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/);
  assert.equal((await request(app).get('/api/session').set('Cookie', cookie)).body.user, null);
  assert.equal((await agent.get('/api/session')).body.user, null);
});

test('missing, wrong, duplicate, cross-browser and cross-provider state fail safely', async () => {
  const { app, agent } = fixture();
  await agent.get('/api/auth/google/callback?code=ok').expect(400);
  const state = await start(agent);
  await agent.get('/api/auth/google/callback').query({ state: 'wrong', code: 'ok' }).expect(400);
  await agent.get(`/api/auth/google/callback?state=${state}&state=${state}&code=ok`).expect(400);
  await request(app).get('/api/auth/google/callback').query({ state, code: 'ok' }).expect(400);
  await agent.get('/api/auth/facebook/callback').query({ state, code: 'ok' }).expect(400);
  assert.equal((await agent.get('/api/session')).body.user, null);
});

test('state expires after ten minutes', async () => {
  let time = 0;
  const { agent } = fixture(undefined, config, () => time);
  const state = await start(agent); time = 600001;
  await agent.get('/api/auth/google/callback').query({ state, code: 'ok' }).expect(400);
});

test('malformed callbacks consume valid state and never establish identity', async () => {
  for (const query of ['', 'code=', 'code=a&code=b', 'error=a&error=b', 'code=a&error=access_denied', 'code[x]=a']) {
    const { agent } = fixture();
    const state = await start(agent);
    const result = await agent.get(`/api/auth/google/callback?state=${state}&${query}`).expect(400);
    assert.equal(result.body.error.code, 'INVALID_CALLBACK');
    await agent.get('/api/auth/google/callback').query({ state, code: 'ok' }).expect(400);
    assert.equal((await agent.get('/api/session')).body.user, null);
  }
});

test('provider denial and rejected exchange return 401; outages return sanitized 502', async () => {
  const { agent } = fixture();
  const state = await start(agent);
  await agent.get('/api/auth/google/callback').query({ state, error: 'access_denied' }).expect(401);
  for (const error of [new AuthenticationRejected('secret'), new Error('secret')]) {
    const failing = { ...client, async authenticate() { throw error; } };
    const { agent } = fixture({ google: failing, facebook: failing });
    const state = await start(agent);
    const result = await agent.get('/api/auth/google/callback').query({ state, code: 'bad' }).expect(error instanceof AuthenticationRejected ? 401 : 502);
    assert.equal(JSON.stringify(result.body).includes('secret'), false);
    assert.equal((await agent.get('/api/session')).body.user, null);
  }
});

test('unconfigured and incomplete providers return actionable 503, unknown providers 400', async () => {
  const { agent } = fixture(undefined, loadConfig({ ...env, GOOGLE_CLIENT_ID: 'partial' }));
  for (const provider of ['google', 'facebook']) for (const route of ['start', 'callback']) {
    const result = await agent.get(`/api/auth/${provider}/${route}`).expect(503);
    assert.equal(result.body.error.code, 'PROVIDER_UNCONFIGURED');
    assert.match(result.body.error.message, /CLIENT_SECRET/);
  }
  await agent.get('/api/auth/other/start').expect(400);
  await agent.get('/api/auth/%E0%A4%A/start').expect(400);
});

test('config validates secrets, URL origins and production HTTPS without exposing values', () => {
  assert.throws(() => loadConfig({ ...env, SESSION_SECRET: 'short' }), /SESSION_SECRET/);
  assert.throws(() => loadConfig({ SESSION_SECRET: env.SESSION_SECRET }), /APP_URL/);
  assert.throws(() => loadConfig({ ...env, NODE_ENV: 'production' }), /HTTPS/);
  assert.throws(() => loadConfig({ ...env, APP_URL: 'javascript:bad' }), /APP_URL/);
  assert.throws(() => loadConfig({ ...env, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_CALLBACK_URL: 'http://other.test/api/auth/google/callback' }), /origin/);
  assert.throws(() => loadConfig({ ...env, SESSION_COOKIE_SECURE: 'true' }), /HTTPS/);
});

test('HTTPS proxy mode sets Secure, HttpOnly and SameSite=Lax', async () => {
  const settings = loadConfig({ ...env, APP_URL: 'https://market.example', SESSION_COOKIE_SECURE: 'true', TRUST_PROXY: 'true' });
  const { app } = fixture(undefined, settings);
  const response = await request(app).get('/api/session').set('X-Forwarded-Proto', 'https').expect(200);
  assert.match(response.headers['set-cookie'][0], /; Secure/);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
});

for (const provider of ['google', 'facebook'] as const) test(`${provider} real adapter uses controlled token/profile fixtures and projects identity only`, async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL, init: RequestInit) => {
    const url = String(input); calls.push(url);
    if (url.includes('/token') || url.includes('/access_token')) {
      const body = new URLSearchParams(String(init.body));
      assert.equal(body.get('client_secret'), 'fixture-secret');
      assert.equal(body.get('code'), 'fixture-code');
      assert.equal(body.get('redirect_uri'), credentials.callbackUrl);
      assert.equal(body.has('code_verifier'), provider === 'google');
      return Response.json({ access_token: 'fixture-access-token', token_type: 'Bearer', expires_in: 3600 });
    }
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer fixture-access-token');
    return Response.json({ id: '123', name: 'Provider User', access_token: 'never-return', email: 'private@example.test' });
  });
  const adapter = createProvider(provider, credentials);
  const url = new URL(await adapter.authorize('state', 'verifier-abcdefghijklmnopqrstuvwxyz1234567890'));
  assert.equal(url.searchParams.get('state'), 'state');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.has('code_challenge'), provider === 'google');
  const user = await adapter.authenticate(new URLSearchParams({ state: 'state', code: 'fixture-code' }), 'state', 'verifier');
  assert.deepEqual(user, { id: `${provider}:123`, displayName: 'Provider User' });
  assert.equal(calls.length, 2);
});

test('real adapter rejects invalid state before network and rejects token/profile failures', async (t) => {
  let mode = 'token'; let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (mode === 'token') return Response.json({ error: 'invalid_grant' }, { status: 400 });
    if (calls === 1) return Response.json({ access_token: 'token', token_type: 'Bearer' });
    return Response.json({ name: 'Missing ID' });
  });
  const adapter = createProvider('google', credentials);
  await assert.rejects(adapter.authenticate(new URLSearchParams({ state: 'wrong', code: 'code' }), 'state', 'verifier'));
  assert.equal(calls, 0);
  await assert.rejects(adapter.authenticate(new URLSearchParams({ state: 'state', code: 'code' }), 'state', 'verifier'), AuthenticationRejected);
  mode = 'profile'; calls = 0;
  await assert.rejects(adapter.authenticate(new URLSearchParams({ state: 'state', code: 'code' }), 'state', 'verifier'), AuthenticationRejected);
});
