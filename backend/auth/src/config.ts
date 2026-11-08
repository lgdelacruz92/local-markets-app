export type Provider = 'google' | 'facebook';
export type ProviderConfig = { clientId: string; clientSecret: string; callbackUrl: string };
export type AuthConfig = {
  appUrl: string; sessionSecret: string; secureCookies: boolean; trustProxy: boolean;
  providers: Partial<Record<Provider, ProviderConfig>>;
};

function webUrl(value: string, name: string, secure: boolean): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an absolute HTTP(S) URL.`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || (secure && url.protocol !== 'https:')) {
    throw new Error(`${name} must be HTTP(S), without credentials/fragment, and HTTPS when SESSION_COOKIE_SECURE=true.`);
  }
  return url.href;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const secureCookies = env.SESSION_COOKIE_SECURE === 'true';
  if (env.SESSION_COOKIE_SECURE && !['true', 'false'].includes(env.SESSION_COOKIE_SECURE)) throw new Error('SESSION_COOKIE_SECURE must be true or false.');
  if (env.TRUST_PROXY && !['true', 'false'].includes(env.TRUST_PROXY)) throw new Error('TRUST_PROXY must be true or false.');
  if (env.NODE_ENV === 'production' && !secureCookies) throw new Error('Production requires SESSION_COOKIE_SECURE=true and HTTPS.');
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('Set SESSION_SECRET to a random secret of at least 32 characters.');
  const appUrl = webUrl(env.APP_URL ?? '', 'APP_URL', secureCookies);
  const providers: AuthConfig['providers'] = {};
  for (const provider of ['google', 'facebook'] as const) {
    const prefix = provider.toUpperCase();
    const clientId = env[`${prefix}_CLIENT_ID`];
    const clientSecret = env[`${prefix}_CLIENT_SECRET`];
    const callback = env[`${prefix}_CALLBACK_URL`];
    // Incomplete credentials disable only this provider; start/callback returns actionable 503.
    if (clientId && clientSecret && callback) {
      const callbackUrl = webUrl(callback, `${prefix}_CALLBACK_URL`, secureCookies);
      const url = new URL(callbackUrl);
      if (url.origin !== new URL(appUrl).origin || url.pathname !== `/api/auth/${provider}/callback` || url.search) {
        throw new Error(`${prefix}_CALLBACK_URL must use APP_URL's origin and /api/auth/${provider}/callback without a query.`);
      }
      providers[provider] = { clientId, clientSecret, callbackUrl };
    }
  }
  return { appUrl, sessionSecret: env.SESSION_SECRET, secureCookies, trustProxy: env.TRUST_PROXY === 'true', providers };
}
