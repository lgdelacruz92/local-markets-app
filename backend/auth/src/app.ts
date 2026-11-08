import express, { type ErrorRequestHandler, type Response } from 'express';
import session from 'express-session';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthConfig, Provider } from './config.js';
import { AuthenticationRejected, createProvider, type OAuthClient, type User } from './providers.js';

declare module 'express-session' {
  interface SessionData {
    user?: User;
    csrfToken?: string;
    pending?: { provider: Provider; state: string; verifier: string; expires: number };
  }
}
const random = () => randomBytes(32).toString('base64url');
const same = (a: string, b: string) => {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const fail = (res: Response, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });

export function createAuthApp(config: AuthConfig, options: { clients?: Partial<Record<Provider, OAuthClient>>; store?: session.Store; now?: () => number } = {}) {
  const app = express();
  const now = options.now ?? Date.now;
  const consumed = new Map<string, number>();
  const clients: Partial<Record<Provider, OAuthClient>> = {};
  for (const provider of ['google', 'facebook'] as const) {
    const settings = config.providers[provider];
    if (settings) clients[provider] = options.clients?.[provider] ?? createProvider(provider, settings);
  }
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  if (config.trustProxy) app.set('trust proxy', 1);
  const cookie = { httpOnly: true, secure: config.secureCookies, sameSite: 'lax' as const, path: '/', maxAge: 8 * 60 * 60 * 1000 };
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(session({ name: 'market.sid', secret: config.sessionSecret, resave: false, saveUninitialized: false, cookie, store: options.store }));
  app.get('/api/session', (req, res) => {
    req.session.csrfToken ??= random();
    res.json({ user: req.session.user ?? null, csrfToken: req.session.csrfToken });
  });
  app.get('/api/auth/:provider/start', async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'facebook') { fail(res, 400, 'INVALID_PROVIDER', 'Use google or facebook.'); return; }
    const client = clients[provider];
    if (!client) { fail(res, 503, 'PROVIDER_UNCONFIGURED', `Set ${provider.toUpperCase()}_CLIENT_ID, ${provider.toUpperCase()}_CLIENT_SECRET and ${provider.toUpperCase()}_CALLBACK_URL on the auth service.`); return; }
    const state = random();
    const verifier = random();
    const url = await client.authorize(state, verifier);
    req.session.pending = { provider, state, verifier, expires: now() + 10 * 60 * 1000 };
    await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.redirect(url);
  });
  app.get('/api/auth/:provider/callback', async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'facebook') { fail(res, 400, 'INVALID_PROVIDER', 'Use google or facebook.'); return; }
    const client = clients[provider];
    if (!client) { fail(res, 503, 'PROVIDER_UNCONFIGURED', `Configure ${provider.toUpperCase()}_CLIENT_ID, ${provider.toUpperCase()}_CLIENT_SECRET and ${provider.toUpperCase()}_CALLBACK_URL.`); return; }
    const pending = req.session.pending;
    const state = req.query.state;
    for (const [key, expires] of consumed) if (expires <= now()) consumed.delete(key);
    if (!pending || pending.provider !== provider || pending.expires <= now() || typeof state !== 'string' || !same(state, pending.state) || consumed.has(state)) {
      fail(res, 400, 'INVALID_STATE', 'OAuth state is missing, invalid, expired or already used. Start sign-in again.'); return;
    }
    consumed.set(state, pending.expires);
    delete req.session.pending;
    await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    const { code, error } = req.query;
    if ((code !== undefined && (typeof code !== 'string' || !code || code.length > 4096)) ||
        (error !== undefined && (typeof error !== 'string' || !error || error.length > 200)) ||
        (code === undefined && error === undefined) || (code !== undefined && error !== undefined) ||
        Object.values(req.query).some(value => typeof value !== 'string')) {
      fail(res, 400, 'INVALID_CALLBACK', 'Expected a single authorization code or provider error. Start sign-in again.'); return;
    }
    if (error !== undefined) { fail(res, 401, 'AUTH_REJECTED', 'Provider authentication was rejected.'); return; }
    try {
      const parameters = new URLSearchParams(req.query as Record<string, string>);
      const user = await client.authenticate(parameters, state, pending.verifier);
      if (!user.id || typeof user.id !== 'string' || typeof user.displayName !== 'string' || !user.displayName) throw new AuthenticationRejected();
      await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
      req.session.user = { id: user.id, displayName: user.displayName };
      req.session.csrfToken = random();
      await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
      res.redirect(config.appUrl);
    } catch (error) {
      if (error instanceof AuthenticationRejected) fail(res, 401, 'AUTH_REJECTED', 'Provider authentication was rejected.');
      else fail(res, 502, 'PROVIDER_UNAVAILABLE', 'Unable to complete authentication. Start sign-in again later.');
    }
  });
  app.post('/api/logout', (req, res, next) => {
    const token = req.get('X-CSRF-Token');
    if (!token || !req.session.csrfToken || !same(token, req.session.csrfToken)) { fail(res, 403, 'INVALID_CSRF', 'X-CSRF-Token must match the session token.'); return; }
    req.session.destroy(error => {
      if (error) { next(error); return; }
      const { maxAge: _maxAge, ...clearOptions } = cookie;
      res.clearCookie('market.sid', clearOptions).sendStatus(204);
    });
  });
  app.use((_req, res) => { fail(res, 404, 'NOT_FOUND', 'Route not found.'); });
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof URIError) { fail(res, 400, 'INVALID_PATH', 'Invalid URL encoding.'); return; }
    fail(res, 500, 'INTERNAL_ERROR', 'Unable to process authentication.');
  };
  app.use(errors);
  return app;
}
