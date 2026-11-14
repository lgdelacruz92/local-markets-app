import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { fetchListings } from '../src/listings/listingsService.ts'
import { LISTING } from './fixtures/listings.js'

const originalFetch = globalThis.fetch

afterEach(() => { globalThis.fetch = originalFetch })

test('public browse uses the same-origin API, cookie credentials, no-store and cancellation signal', async () => {
  const controller = new AbortController()
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/listings')
    assert.deepEqual(options, {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    })
    return Response.json({ items: [LISTING] })
  }
  assert.deepEqual(await fetchListings(controller.signal), [LISTING])
})

test('an empty collection is a successful response', async () => {
  globalThis.fetch = async () => Response.json({ items: [] })
  assert.deepEqual(await fetchListings(new AbortController().signal), [])
})

test('HTTP, network and invalid JSON failures reject with diagnostics', async () => {
  globalThis.fetch = async () => new Response('private server details', { status: 503 })
  await assert.rejects(fetchListings(new AbortController().signal), /HTTP 503/)
  globalThis.fetch = async () => { throw new TypeError('Offline fixture') }
  await assert.rejects(fetchListings(new AbortController().signal), /Offline fixture/)
  globalThis.fetch = async () => new Response('<html>not JSON</html>')
  await assert.rejects(fetchListings(new AbortController().signal), SyntaxError)
})

test('malformed items and duplicate IDs are rejected before rendering', async () => {
  const invalidBodies = [
    null, {}, { items: null }, { items: [null] }, { items: [{}] },
    { items: [{ ...LISTING, price: -1 }] },
    { items: [{ ...LISTING, currency: 'not-currency' }] },
    { items: [{ ...LISTING, seller: null }] },
    { items: [{ ...LISTING, title: 123 }] },
    { items: [{ ...LISTING, status: 'unknown' }] },
    { items: [LISTING, LISTING] },
  ]
  for (const body of invalidBodies) {
    globalThis.fetch = async () => Response.json(body)
    await assert.rejects(fetchListings(new AbortController().signal), /API contract|duplicate IDs/)
  }
})
