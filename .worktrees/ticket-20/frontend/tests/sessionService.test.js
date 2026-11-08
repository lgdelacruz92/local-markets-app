import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { fetchSession } from '../src/session/sessionService.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('session fetch sends no body and uses same-origin cookie and no-store', async () => {
  const signal = new AbortController().signal
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/session')
    assert.deepEqual(options, { credentials: 'same-origin', cache: 'no-store', signal })
    return Response.json({ user: null, csrfToken: 'test-only-token' })
  }
  assert.deepEqual(await fetchSession(signal), { user: null, csrfToken: 'test-only-token' })
})

test('signed-in response preserves the contracted identity', async () => {
  const session = { user: { id: 'fixture-user', displayName: 'Test Seller' }, csrfToken: 'fixture' }
  globalThis.fetch = async () => Response.json(session)
  assert.deepEqual(await fetchSession(new AbortController().signal), session)
})

test('HTTP failure retains its status for debugging', async () => {
  globalThis.fetch = async () => Response.json({ error: { code: 'unavailable', message: 'Unavailable' } }, { status: 503 })
  await assert.rejects(fetchSession(new AbortController().signal), /HTTP 503/)
})

test('network and invalid JSON failures reject', async () => {
  globalThis.fetch = async () => { throw new Error('Offline') }
  await assert.rejects(fetchSession(new AbortController().signal), /Offline/)
  globalThis.fetch = async () => new Response('not JSON')
  await assert.rejects(fetchSession(new AbortController().signal), SyntaxError)
})

test('malformed success bodies never become signed-in sessions', async () => {
  for (const body of [null, {}, { user: {}, csrfToken: 'fixture' }, { user: null }, { user: 'invalid', csrfToken: 'fixture' }]) {
    globalThis.fetch = async () => Response.json(body)
    await assert.rejects(fetchSession(new AbortController().signal), /API contract/)
  }
})
