import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { z } from 'zod';

const sessionSchema = z.object({
  user: z.object({ id: z.string().min(1), displayName: z.string().min(1) }).nullable(),
  csrfToken: z.string().min(1),
});
export type SessionUser = { id: string; displayName: string };
declare global {
  namespace Express { interface Locals { user?: SessionUser } }
}

/** Auth service is the sole session authority. Never trust client-supplied user IDs. */
export function requireSessionWrite(authServiceUrl: string, fetchSession: typeof fetch = fetch): RequestHandler {
  const base = new URL(authServiceUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('AUTH_SERVICE_URL must be the trusted internal auth service HTTP(S) origin.');
  }
  const endpoint = new URL('/api/session', base);
  return async (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) { next(); return; }
    if (!req.headers.cookie) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in before modifying listings.' } }); return;
    }
    try {
      const response = await fetchSession(endpoint, { headers: { Cookie: req.headers.cookie }, signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!response.ok) throw new Error('Session authority unavailable');
      const session = sessionSchema.parse(await response.json());
      if (!session.user) {
        res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in before modifying listings.' } }); return;
      }
      const token = req.get('X-CSRF-Token');
      const actual = Buffer.from(token ?? ''); const expected = Buffer.from(session.csrfToken);
      if (!token || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        res.status(403).json({ error: { code: 'INVALID_CSRF', message: 'X-CSRF-Token must match the session token.' } }); return;
      }
      res.locals.user = session.user;
      next();
    } catch {
      res.status(503).json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Session verification is unavailable. Try again later.' } });
    }
  };
}
