import * as oauth from 'oauth4webapi';
import type { Provider, ProviderConfig } from './config.js';

export type User = { id: string; displayName: string };
export class AuthenticationRejected extends Error {}
export interface OAuthClient {
  authorize(state: string, verifier: string): Promise<string>;
  authenticate(parameters: URLSearchParams, state: string, verifier: string): Promise<User>;
}

export function createProvider(provider: Provider, config: ProviderConfig): OAuthClient {
  const google = provider === 'google';
  const authorizationUrl = google ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://www.facebook.com/v22.0/dialog/oauth';
  const as: oauth.AuthorizationServer = {
    issuer: google ? 'https://accounts.google.com' : 'https://www.facebook.com',
    token_endpoint: google ? 'https://oauth2.googleapis.com/token' : 'https://graph.facebook.com/v22.0/oauth/access_token',
  };
  const client: oauth.Client = { client_id: config.clientId };
  return {
    async authorize(state, verifier) {
      const url = new URL(authorizationUrl);
      url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.callbackUrl, response_type: 'code', state,
        scope: google ? 'https://www.googleapis.com/auth/userinfo.profile' : 'public_profile' }).toString();
      if (google) {
        url.searchParams.set('code_challenge', await oauth.calculatePKCECodeChallenge(verifier));
        url.searchParams.set('code_challenge_method', 'S256');
      }
      return url.href;
    },
    async authenticate(parameters, state, verifier) {
      try {
        const validated = oauth.validateAuthResponse(as, client, parameters, state);
        const response = await oauth.authorizationCodeGrantRequest(as, client, oauth.ClientSecretPost(config.clientSecret), validated,
          config.callbackUrl, google ? verifier : oauth.nopkce, { signal: AbortSignal.timeout(10000) });
        const tokens = await oauth.processGenericTokenEndpointResponse(as, client, response);
        const profileUrl = google ? 'https://www.googleapis.com/oauth2/v2/userinfo' : 'https://graph.facebook.com/v22.0/me?fields=id,name';
        const profileResponse = await fetch(profileUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(10000), redirect: 'error' });
        if (profileResponse.status === 401 || profileResponse.status === 403) throw new AuthenticationRejected();
        if (!profileResponse.ok) throw new Error('Provider unavailable');
        const profile = await profileResponse.json() as { id?: unknown; name?: unknown };
        if (typeof profile.id !== 'string' || !profile.id || profile.id.length > 200 || typeof profile.name !== 'string' || !profile.name.trim() || profile.name.length > 200) throw new AuthenticationRejected();
        return { id: `${provider}:${profile.id}`, displayName: profile.name };
      } catch (error) {
        if (error instanceof oauth.ResponseBodyError || error instanceof oauth.AuthorizationResponseError) throw new AuthenticationRejected();
        throw error;
      }
    },
  };
}
