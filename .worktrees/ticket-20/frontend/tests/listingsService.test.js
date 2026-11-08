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

test('individual and combined filters use encoded query values with no body', async () => {
  const filtersToCheck = [
    { q: 'Chair & lamp + #1?' },
    { locality: 'São José / North' },
    { category: 'Furniture' },
    { q: ' chair ', locality: ' Northside ', category: ' Furniture & Home ' },
  ]
  for (const filters of filtersToCheck) {
    globalThis.fetch = async (url, options) => {
      const parsedUrl = new URL(url, 'http://localhost')
      assert.equal(parsedUrl.pathname, '/api/listings')
      for (const key of ['q', 'locality', 'category']) {
        assert.equal(parsedUrl.searchParams.get(key), filters[key]?.trim() || null)
      }
      assert.equal(options.method, 'GET')
      assert.equal(options.body, undefined)
      return Response.json({ items: [LISTING] })
    }
    // Returned fixtures are rendered as given; no local search matching occurs.
    assert.deepEqual(await fetchListings(signal, filters), [LISTING])
  }
})

test('cleared and whitespace-only filters omit the query entirely', async () => {
  globalThis.fetch = async url => {
    assert.equal(url, '/api/listings')
    return Response.json({ items: LISTINGS })
  }
  assert.deepEqual(await fetchListings(signal, {}), LISTINGS)
  assert.deepEqual(await fetchListings(signal, { q: '  ', locality: '\t', category: '' }), LISTINGS)
})
