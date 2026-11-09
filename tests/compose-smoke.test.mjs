import assert from 'node:assert/strict'
import test from 'node:test'

const origin = process.env.COMPOSE_TEST_URL ?? 'http://localhost:3000'
const request = (path, options) => fetch(new URL(path, origin), options)

test('frontend and same-origin backend routes work together', async () => {
  const page = await request('/')
  assert.equal(page.status, 200)
  assert.match(await page.text(), /<div id="root"><\/div>/)

  const response = await request('/api/session')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
  const cookie = response.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie?.startsWith('market.sid='))
  const session = await response.json()
  assert.equal(session.user, null)
  assert.ok(session.csrfToken)

  const again = await request('/api/session', { headers: { cookie } })
  assert.equal((await again.json()).csrfToken, session.csrfToken)

  const listings = await request('/api/listings')
  assert.equal(listings.status, 200)
  const { items } = await listings.json()
  assert.ok(Array.isArray(items))
  if (items.length) {
    const detail = await request(`/api/listings/${encodeURIComponent(items[0].id)}`)
    assert.equal(detail.status, 200)
    assert.equal((await detail.json()).listing.id, items[0].id)
  }

  const write = await request('/api/listings', { method: 'POST', headers: { cookie } })
  assert.equal(write.status, 401)
  assert.equal((await write.json()).error.code, 'UNAUTHENTICATED')

  const logout = await request('/api/logout', {
    method: 'POST', headers: { cookie, 'X-CSRF-Token': session.csrfToken },
  })
  assert.equal(logout.status, 204)

  const unknown = await request('/api/not-a-route')
  assert.equal(unknown.status, 404)
  assert.equal((await unknown.json()).error.code, 'NOT_FOUND')
})

test('configured Google sign-in uses the frontend callback origin', async () => {
  const response = await request('/api/auth/google/start', { redirect: 'manual' })
  if (response.status === 503) {
    assert.equal((await response.json()).error.code, 'PROVIDER_UNCONFIGURED')
    return
  }
  assert.equal(response.status, 302)
  const authorizationUrl = new URL(response.headers.get('location'))
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), new URL('/api/auth/google/callback', origin).href)
})
