import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { LISTING } from './fixtures/listings.js'

const originalFetch = globalThis.fetch
let server
let dom
let root
let SessionContext
let MarkSoldControl
let ListingGrid
let useListings
let useListingDetail
let requests
let currentListings

function SoldFixture() {
  const listings = useListings()
  const detail = useListingDetail(LISTING.id)
  useEffect(() => { currentListings = listings }, [listings])
  return createElement('div', null,
    createElement('p', { id: 'detail-status' }, detail.listing?.status),
    detail.listing && createElement(MarkSoldControl, {
      listing: detail.listing, updateListing: detail.updateListing, refreshListings: listings.refetch,
    }),
    createElement(ListingGrid, { ...listings, onRetry: listings.refetch }),
  )
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  SessionContext = (await server.ssrLoadModule('/src/session/SessionContext.ts')).SessionContext
  MarkSoldControl = (await server.ssrLoadModule('/src/listings/MarkSoldControl.tsx')).default
  ListingGrid = (await server.ssrLoadModule('/src/listings/ListingGrid.tsx')).default
  useListings = (await server.ssrLoadModule('/src/listings/useListings.ts')).useListings
  useListingDetail = (await server.ssrLoadModule('/src/listings/useListingDetail.ts')).useListingDetail
})

beforeEach(() => {
  dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  requests = []
  globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
    requests.push({ url, options, resolve, reject })
  })
  root = createRoot(document.getElementById('root'))
})

afterEach(async () => {
  await act(async () => root.unmount())
  dom.window.close()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.fetch = originalFetch
})
after(async () => server.close())

async function mount() {
  const session = {
    user: { id: LISTING.seller.id, displayName: 'Fixture owner' }, csrfToken: 'fixture-csrf',
    isLoading: false, error: null, refreshSession: async () => {}, resetSession: () => {},
  }
  await act(async () => root.render(createElement(SessionContext.Provider, { value: session }, createElement(SoldFixture))))
  const listRequest = requests.find(request => request.url === '/api/listings')
  const detailRequest = requests.find(request => request.url === `/api/listings/${LISTING.id}`)
  await act(async () => {
    listRequest.resolve(Response.json({ items: [LISTING] }))
    detailRequest.resolve(Response.json({ listing: LISTING }))
  })
}

async function clickSold() {
  const button = [...document.querySelectorAll('button')].find(button => button.textContent === 'Mark as sold')
  await act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })))
  return requests.find(request => request.options.method === 'PATCH')
}

test('confirmed sale updates the detail interface and the same shared list state removes the sold card', async () => {
  await mount()
  assert.deepEqual(currentListings.items, [LISTING])
  const mutation = await clickSold()
  assert.equal(document.getElementById('detail-status').textContent, 'available')
  assert.equal(document.querySelector('.mark-sold-control button').disabled, true)
  await act(async () => mutation.resolve(Response.json({ listing: { ...LISTING, status: 'sold' } })))
  assert.equal(document.getElementById('detail-status').textContent, 'sold')
  assert.equal(currentListings.isLoading, true)
  const refresh = requests.at(-1)
  assert.equal(refresh.url, '/api/listings')
  assert.equal(refresh.options.method, 'GET')
  await act(async () => refresh.resolve(Response.json({ items: [] })))
  assert.deepEqual(currentListings.items, [])
  assert.equal(currentListings.isLoading, false)
  assert.equal(document.querySelectorAll('.listing-card').length, 0)
  assert.match(document.body.textContent, /Item marked sold\./)
})

test('unmount aborts a pending sold request and a late response cannot refresh the shared list', async () => {
  await mount()
  const mutation = await clickSold()
  const requestCount = requests.length
  await act(async () => root.unmount())
  assert.equal(mutation.options.signal.aborted, true)
  await act(async () => mutation.resolve(Response.json({ listing: { ...LISTING, status: 'sold' } })))
  assert.equal(requests.length, requestCount)
})
