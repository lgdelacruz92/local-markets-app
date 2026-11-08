import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { fetchListings } from '../src/listings/listingsService.ts'
import { LISTING, LISTINGS } from './fixtures/listings.js'

const originalFetch = globalThis.fetch
const signal = new AbortController().signal

afterEach(() => { globalThis.fetch = originalFetch })

test('public listing fetch uses the agreed GET path without a body or auth headers', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/listings')
    assert.deepEqual(options, { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal })
    return Response.json({ items: LISTINGS })
  }
  assert.deepEqual(await fetchListings(signal), LISTINGS)
})

test('empty response stays empty and sold items are not browsable', async () => {
  globalThis.fetch = async () => Response.json({ items: [] })
  assert.deepEqual(await fetchListings(signal), [])
  globalThis.fetch = async () => Response.json({ items: [LISTING, { ...LISTING, status: 'sold' }] })
  assert.deepEqual(await fetchListings(signal), [LISTING])
})

test('HTTP contract error, network failure, and invalid JSON reject explicitly', async () => {
  globalThis.fetch = async () => Response.json({ error: { code: 'UNAVAILABLE', message: 'Unavailable' } }, { status: 503 })
  await assert.rejects(fetchListings(signal), /HTTP 503/)
  globalThis.fetch = async () => { throw new Error('Offline') }
  await assert.rejects(fetchListings(signal), /Offline/)
  globalThis.fetch = async () => new Response('not JSON')
  await assert.rejects(fetchListings(signal), SyntaxError)
})

test('malformed successful responses reject instead of displaying broken cards', async () => {
  const bodies = [null, {}, { items: null }, { items: [{}] },
    { items: [{ ...LISTING, price: -1 }] }, { items: [{ ...LISTING, imageUrls: [123] }] },
    { items: [{ ...LISTING, seller: null }] }, { items: [{ ...LISTING, status: 'unknown' }] }]
  for (const body of bodies) {
    globalThis.fetch = async () => Response.json(body)
    await assert.rejects(fetchListings(signal), /API contract/)
  }
})
