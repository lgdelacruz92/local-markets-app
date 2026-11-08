import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { markListingSold } from '../src/listings/markSoldService.ts'
import { LISTING } from './fixtures/listings.js'

const originalFetch = globalThis.fetch
const signal = new AbortController().signal
afterEach(() => { globalThis.fetch = originalFetch })

test('sold PATCH encodes ID, sends exact body/CSRF header and same-origin cookie credentials', async () => {
  const listing = { ...LISTING, id: 'item/with space', status: 'sold' }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/listings/item%2Fwith%20space')
    assert.deepEqual(options, {
      method: 'PATCH', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'fixture-token' },
      body: '{"status":"sold"}', signal,
    })
    return Response.json({ listing })
  }
  assert.deepEqual(await markListingSold(listing.id, 'fixture-token', signal), listing)
})

test('missing CSRF token rejects without a request', async () => {
  globalThis.fetch = async () => { assert.fail('No request should be made') }
  await assert.rejects(markListingSold(LISTING.id, '', signal), /session is not ready/)
})

test('400/401/403/404 and other statuses reject without trusting server error text', async () => {
  for (const status of [400, 401, 403, 404, 500, 201, 204]) {
    globalThis.fetch = async () => new Response(null, { status })
    await assert.rejects(markListingSold(LISTING.id, 'fixture-token', signal))
  }
})

test('network, malformed JSON, unconfirmed status, wrong ID and malformed listing reject', async () => {
  globalThis.fetch = async () => { throw new TypeError('Offline') }
  await assert.rejects(markListingSold(LISTING.id, 'fixture-token', signal), /Offline/)
  globalThis.fetch = async () => new Response('invalid JSON')
  await assert.rejects(markListingSold(LISTING.id, 'fixture-token', signal), SyntaxError)
  for (const body of [null, {}, { listing: LISTING }, { listing: { ...LISTING, status: 'sold', id: 'wrong' } },
    { listing: { ...LISTING, status: 'sold', price: -1 } }]) {
    globalThis.fetch = async () => Response.json(body)
    await assert.rejects(markListingSold(LISTING.id, 'fixture-token', signal), /could not be confirmed/)
  }
})
