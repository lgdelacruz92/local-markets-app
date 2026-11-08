import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { logout } from '../src/auth/logoutService.ts'

const originalFetch = globalThis.fetch

afterEach(() => { globalThis.fetch = originalFetch })

test('logout sends POST, same-origin cookie and CSRF header with no body; accepts empty 204', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/logout')
    assert.deepEqual(options, {
      method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': 'test-only-token' },
    })
    return new Response(null, { status: 204 })
  }
  await logout('test-only-token')
})

test('missing token fails before making a request', async () => {
  let requestCount = 0
  globalThis.fetch = async () => { requestCount += 1 }
  await assert.rejects(logout(''), /security token is missing/)
  assert.equal(requestCount, 0)
})

test('403 error contract provides safe security-check feedback', async () => {
  globalThis.fetch = async () => Response.json({
    error: { code: 'INVALID_CSRF', message: 'Invalid or missing CSRF token' },
  }, { status: 403 })
  await assert.rejects(logout('fixture-token'), /security check/)
})

test('unexpected 200 and server failures never count as successful logout', async () => {
  for (const status of [200, 500, 503]) {
    globalThis.fetch = async () => new Response('Unexpected response', { status })
    await assert.rejects(logout('fixture-token'), new RegExp(`HTTP ${status}`))
  }
})

test('network failure provides retry feedback and retains diagnostics as cause', async () => {
  const networkError = new TypeError('Test-only network failure')
  globalThis.fetch = async () => { throw networkError }
  await assert.rejects(logout('fixture-token'), (error) => {
    assert.match(error.message, /Check your connection and try again/)
    assert.equal(error.cause, networkError)
    return true
  })
})
