import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { fetchListing } from '../src/listings/listingDetailService.ts'
import { LISTING } from './fixtures/listings.js'

const originalFetch = globalThis.fetch
const signal = new AbortController().signal
afterEach(() => { globalThis.fetch = originalFetch })

test('public detail encodes the ID, uses GET without a body/auth headers, and accepts sold', async () => {
  const listing = { ...LISTING, id: 'id/with space', status: 'sold' }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/listings/id%2Fwith%20space')
    assert.deepEqual(options, { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal })
    return Response.json({ listing })
  }
  assert.deepEqual(await fetchListing(listing.id, signal), listing)
})

test('404 returns missing without requiring a JSON body', async () => {
  globalThis.fetch = async () => new Response('', { status: 404 })
  assert.equal(await fetchListing(LISTING.id, signal), null)
})

test('HTTP, network and invalid JSON failures reject', async () => {
  globalThis.fetch = async () => Response.json({ error: { code: 'UNAVAILABLE', message: 'Fixture' } }, { status: 503 })
  await assert.rejects(fetchListing(LISTING.id, signal), /HTTP 503/)
  globalThis.fetch = async () => { throw new Error('Offline') }
  await assert.rejects(fetchListing(LISTING.id, signal), /Offline/)
  globalThis.fetch = async () => new Response('invalid JSON')
  await assert.rejects(fetchListing(LISTING.id, signal), SyntaxError)
})

test('malformed payload and mismatched ID reject', async () => {
  for (const body of [null, {}, { listing: {} }, { listing: { ...LISTING, id: 'wrong' } },
    { listing: { ...LISTING, price: -1 } }, { listing: { ...LISTING, status: 'invalid' } }]) {
    globalThis.fetch = async () => Response.json(body)
    await assert.rejects(fetchListing(LISTING.id, signal), /API contract/)
  }
})
