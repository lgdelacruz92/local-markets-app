import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { act, createElement, StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { LISTING } from './fixtures/listings.js'

const originalFetch = globalThis.fetch
const originalConsoleError = console.error
let server, dom, root, useListingDetail, currentDetail, requests

function DetailConsumer({ id }) {
  const detail = useListingDetail(id)
  useEffect(() => { currentDetail = detail }, [detail])
  return createElement('p', null, detail.listing?.status ?? 'No listing')
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  useListingDetail = (await server.ssrLoadModule('/src/listings/useListingDetail.ts')).useListingDetail
})
beforeEach(() => {
  dom = new JSDOM('<div id="root"></div>')
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  root = createRoot(document.getElementById('root'))
  requests = []
  // Deferred mock responses let tests simulate out-of-order API completion.
  globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
    requests.push({ url, options, resolve, reject })
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  dom.window.close()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.fetch = originalFetch
  console.error = originalConsoleError
})
after(async () => server.close())

async function mount(id = LISTING.id, isStrict = false) {
  const consumer = createElement(DetailConsumer, { id })
  await act(async () => root.render(isStrict ? createElement(StrictMode, null, consumer) : consumer))
}
async function respond(request, listing) {
  await act(async () => request.resolve(Response.json({ listing })))
}

test('loads by ID and exposes confirmed detail fields/status', async () => {
  await mount()
  assert.equal(currentDetail.isLoading, true)
  assert.equal(currentDetail.listing, null)
  assert.equal(requests[0].url, `/api/listings/${LISTING.id}`)
  await respond(requests[0], LISTING)
  assert.deepEqual(currentDetail.listing, LISTING)
  assert.equal(currentDetail.isLoading, false)
  assert.equal(currentDetail.isMissing, false)
})

test('missing and failure states are distinct; refetch recovers', async () => {
  const errors = []
  console.error = (...details) => errors.push(details)
  await mount()
  await act(async () => requests[0].resolve(new Response('', { status: 404 })))
  assert.equal(currentDetail.isMissing, true)
  assert.equal(currentDetail.error, null)
  let refresh
  await act(async () => { refresh = currentDetail.refetch() })
  await act(async () => { requests[1].reject(new Error('Offline')); await refresh })
  assert.equal(currentDetail.isMissing, false)
  assert.match(currentDetail.error, /Unable to load/)
  assert.equal(errors.length, 1)
  await act(async () => { refresh = currentDetail.refetch() })
  await act(async () => { requests[2].resolve(Response.json({ listing: LISTING })); await refresh })
  assert.equal(currentDetail.error, null)
  assert.deepEqual(currentDetail.listing, LISTING)
})

test('update interface cancels stale reads, accepts sold, rejects another ID without mutations', async () => {
  await mount()
  await act(async () => currentDetail.updateListing({ ...LISTING, status: 'sold' }))
  assert.equal(requests[0].options.signal.aborted, true)
  assert.equal(currentDetail.listing.status, 'sold')
  await respond(requests[0], LISTING)
  assert.equal(currentDetail.listing.status, 'sold')
  assert.throws(() => currentDetail.updateListing({ ...LISTING, id: 'other' }), /another listing/)
  assert.equal(requests.length, 1)
})

test('ID changes abort old reads and prevent stale content', async () => {
  await mount()
  await respond(requests[0], LISTING)
  await mount('second')
  assert.equal(currentDetail.listing, null)
  assert.equal(currentDetail.isLoading, true)
  let refresh
  await act(async () => { refresh = currentDetail.refetch() })
  assert.equal(requests[1].options.signal.aborted, true)
  await act(async () => {
    requests[2].resolve(Response.json({ listing: { ...LISTING, id: 'second', status: 'sold' } }))
    await refresh
  })
  await respond(requests[1], { ...LISTING, id: 'second' })
  assert.equal(currentDetail.listing.status, 'sold')
})

test('StrictMode and unmount cancel requests', async () => {
  await mount(LISTING.id, true)
  assert.equal(requests.length, 2)
  assert.equal(requests[0].options.signal.aborted, true)
  await act(async () => root.unmount())
  assert.equal(requests[1].options.signal.aborted, true)
})
