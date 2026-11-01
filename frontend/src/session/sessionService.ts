import type { Session } from './types.ts'

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false
  if (!('csrfToken' in value) || typeof value.csrfToken !== 'string') return false
  if (!('user' in value)) return false
  if (value.user === null) return true

  const user = value.user
  return typeof user === 'object' && user !== null &&
    'id' in user && typeof user.id === 'string' &&
    'displayName' in user && typeof user.displayName === 'string'
}

/** Loads identity without storing credentials or the session cookie in JavaScript. */
export async function fetchSession(signal: AbortSignal): Promise<Session> {
  const response = await fetch('/api/session', {
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new Error(`Session request failed (HTTP ${response.status}).`)
  }

  const session: unknown = await response.json()
  if (!isSession(session)) {
    throw new Error('Session response did not match the API contract.')
  }
  return session
}
