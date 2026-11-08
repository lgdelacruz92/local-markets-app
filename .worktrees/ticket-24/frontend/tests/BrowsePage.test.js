import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { act, createElement, StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { LISTING, LISTINGS } from './fixtures/listings.js'

const originalFetch = globalThis.fetch
const originalConsoleError = console.error
let server
let dom
let root
let BrowsePage
let ListingGrid
let useListings
let currentList
let requests
let errors

function ListConsumer() {
  const listings = useListings()
  useEffect(() => { currentList = listings }, [listings])
  return createElement(ListingGrid, { ...listings, onRetry: listings.refetch })
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  BrowsePage = (await server.ssrLoadModule('/src/listings/BrowsePage.tsx')).default
  ListingGrid = (await server.ssrLoadModule('/src/listings/ListingGrid.tsx')).default
  useListings = (await server.ssrLoadModule('/src/listings/useListings.ts')).useListings
})

beforeEach(() => {
  dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  root = createRoot(document.getElementById('root'))
  requests = []
  errors = []
  console.error = (...details) => errors.push(details)
  // Deferred test requests let assertions observe the loading state without timing sleeps.
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

function BrowseFixture(props) {
  const listings = useListings()
  return createElement(BrowsePage, { ...props, listings })
}

async function mount(component = BrowseFixture, props = {}) {
  await act(async () => root.render(createElement(component, props)))
}

async function respond(request, items) {
  await act(async () => request.resolve(Response.json({ items })))
}

async function click(element) {
  await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })))
}

test('public page immediately requests listings and shows accessible loading feedback', async () => {
  await mount()
  assert.equal(requests[0].url, '/api/listings')
  assert.equal(requests[0].options.method, 'GET')
  assert.match(document.querySelector('[role="status"]').textContent, /Loading available listings/)
  assert.equal(document.querySelector('section').getAttribute('aria-busy'), 'true')
  assert.equal(document.querySelector('button').disabled, true)
})

test('representative cards show title, numeric price/currency, locality, photo, and detail link', async () => {
  await mount()
  await respond(requests[0], LISTINGS)
  const cards = document.querySelectorAll('.listing-card')
  assert.equal(cards.length, 3)
  assert.equal(cards[0].querySelector('h3').textContent, LISTING.title)
  assert.match(cards[0].querySelector('.listing-price').textContent, /35\.5 USD/)
  assert.equal(cards[0].querySelector('.listing-locality').textContent, LISTING.locality)
  assert.equal(cards[0].querySelector('img').src, LISTING.imageUrls[0])
  assert.equal(cards[0].querySelector('img').alt, LISTING.title)
  assert.equal(cards[0].querySelector('a').getAttribute('href'), '/listings/fixture-chair')
  assert.match(cards[1].textContent, /0 EUR/)
  assert.match(cards[1].textContent, /No photo available/)
  await act(async () => cards[2].querySelector('img').dispatchEvent(new dom.window.Event('error')))
  assert.match(cards[2].textContent, /No photo available/)
  assert.equal(document.querySelector('section').getAttribute('aria-busy'), 'false')
})

test('listing-open callback receives the selected listing and prevents default navigation', async () => {
  let openedListing
  await mount(BrowseFixture, { onOpenListing: listing => { openedListing = listing } })
  await respond(requests[0], [LISTING])
  const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })
  await act(async () => document.querySelector('.listing-link').dispatchEvent(event))
  assert.deepEqual(openedListing, LISTING)
  assert.equal(event.defaultPrevented, true)
})

test('empty response shows guidance rather than a blank grid', async () => {
  await mount()
  await respond(requests[0], [])
  assert.match(document.querySelector('[role="status"]').textContent, /No listings yet/)
  assert.equal(document.querySelector('.listing-grid'), null)
})

test('HTTP failure shows safe feedback; retry reloads cards', async () => {
  await mount()
  await act(async () => requests[0].resolve(Response.json({ error: { code: 'UNAVAILABLE', message: 'private debug data' } }, { status: 503 })))
  assert.match(document.querySelector('[role="alert"]').textContent, /Unable to load listings/)
  assert.doesNotMatch(document.body.textContent, /private debug data/)
  assert.equal(errors.length, 1)
  assert.match(errors[0][1].message, /503/)
  await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Try again'))
  assert.equal(requests.length, 2)
  assert.match(document.querySelector('[role="status"]').textContent, /Loading/)
  await respond(requests[1], [LISTING])
  assert.equal(document.querySelector('[role="alert"]'), null)
  assert.equal(document.querySelectorAll('.listing-card').length, 1)
})

test('network failure is handled without an unhandled rejection', async () => {
  await mount()
  await act(async () => requests[0].reject(new Error('Offline')))
  assert.match(document.querySelector('[role="alert"]').textContent, /Please try again/)
  assert.equal(errors.length, 1)
})

test('current-list/refetch exposes new state and ignores stale responses', async () => {
  await mount(ListConsumer)
  assert.equal(currentList.isLoading, true)
  await respond(requests[0], [LISTING])
  assert.deepEqual(currentList.items, [LISTING])
  let firstRefresh
  await act(async () => { firstRefresh = currentList.refetch() })
  assert.equal(currentList.isLoading, true)
  assert.deepEqual(currentList.items, [])
  let secondRefresh
  await act(async () => { secondRefresh = currentList.refetch() })
  assert.equal(requests[1].options.signal.aborted, true)
  await act(async () => { requests[2].resolve(Response.json({ items: LISTINGS })); assert.equal(await secondRefresh, true) })
  await act(async () => { requests[1].resolve(Response.json({ items: [] })); assert.equal(await firstRefresh, false) })
  assert.deepEqual(currentList.items, LISTINGS)
  assert.equal(currentList.isLoading, false)
  assert.equal(currentList.error, null)
})

test('refetch returns false and exposes visible failure state on a failed list refresh', async () => {
  await mount(ListConsumer)
  await respond(requests[0], [LISTING])
  let refresh
  await act(async () => { refresh = currentList.refetch() })
  await act(async () => {
    requests[1].resolve(new Response(null, { status: 503 }))
    assert.equal(await refresh, false)
  })
  assert.match(currentList.error, /Unable to load listings/)
  assert.deepEqual(currentList.items, [])
  assert.equal(currentList.isLoading, false)
})

test('StrictMode and unmount cancel outstanding requests', async () => {
  await act(async () => root.render(createElement(StrictMode, null, createElement(BrowseFixture))))
  assert.equal(requests.length, 2)
  assert.equal(requests[0].options.signal.aborted, true)
  await act(async () => root.unmount())
  assert.equal(requests[1].options.signal.aborted, true)
  await respond(requests[1], LISTINGS)
  assert.equal(errors.length, 0)
})
