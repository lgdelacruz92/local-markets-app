import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { LISTING } from './fixtures/listings.js'

let server
let dom
let root
let ListingCard

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  ListingCard = (await server.ssrLoadModule('/src/listings/ListingCard.tsx')).default
})

beforeEach(() => {
  dom = new JSDOM('<div id="root"></div>')
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  root = createRoot(document.getElementById('root'))
})

afterEach(async () => {
  await act(async () => root.unmount())
  dom.window.close()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
})

after(async () => server.close())

async function renderListing(imageUrls = LISTING.imageUrls) {
  await act(async () => root.render(createElement(ListingCard, { listing: { ...LISTING, imageUrls } })))
}

function buttonNamed(name) {
  return [...document.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === name || button.textContent === name)
}

async function click(name) {
  await act(async () => buttonNamed(name).click())
}

function photo() {
  return document.querySelector('.listing-photo')
}

test('renders API cover photo with descriptive alt text, loading state, thumbnails and full-size link', async () => {
  await renderListing()
  assert.equal(photo().getAttribute('src'), LISTING.imageUrls[0])
  assert.equal(photo().alt, `${LISTING.title} — photo 1 of 3`)
  assert.equal(photo().getAttribute('loading'), 'lazy')
  assert.equal(photo().getAttribute('referrerpolicy'), 'no-referrer')
  assert.match(document.body.textContent, /Loading photo/)
  await act(async () => photo().dispatchEvent(new window.Event('load')))
  assert.doesNotMatch(document.body.textContent, /Loading photo/)
  assert.equal(document.querySelectorAll('.listing-photo-thumbnails button').length, 3)
  assert.equal(document.querySelector('a').href, LISTING.imageUrls[0])
  assert.equal(document.querySelector('a').target, '_blank')
})

test('original demo listings use bundled photos and full-size links with visible credits', async () => {
  const originalUrl = 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91'
  await act(async () => root.render(createElement(ListingCard, {
    listing: { ...LISTING, id: 'seed-chair', imageUrls: [originalUrl] },
  })))
  assert.equal(photo().getAttribute('src'), '/demo-listings/chair.jpg')
  assert.equal(document.querySelector('a').getAttribute('href'), '/demo-listings/chair.jpg')
  assert.match(document.body.textContent, /Illustrative demo photo/)
  assert.equal(document.querySelector('a[href="/demo-listings/credits.html"]').textContent, 'Photo credits')

  await renderListing([originalUrl])
  assert.equal(photo().getAttribute('src'), originalUrl)
  assert.doesNotMatch(document.body.textContent, /Illustrative demo photo/)
})

test('previous/next wrap and thumbnails choose the requested photo', async () => {
  await renderListing()
  await click(`Next photo of ${LISTING.title}`)
  assert.equal(photo().src, LISTING.imageUrls[1])
  assert.match(document.querySelector('[aria-live]').textContent, /Photo 2 of 3/)
  await click(`Show photo 3 of ${LISTING.title}`)
  assert.equal(photo().src, LISTING.imageUrls[2])
  assert.equal(buttonNamed(`Show photo 3 of ${LISTING.title}`).getAttribute('aria-pressed'), 'true')
  await click(`Next photo of ${LISTING.title}`)
  assert.equal(photo().src, LISTING.imageUrls[0])
  await click(`Previous photo of ${LISTING.title}`)
  assert.equal(photo().src, LISTING.imageUrls[2])
  assert.equal(document.querySelector('a').href, LISTING.imageUrls[2])
})

test('arrow keys browse the focused gallery without intercepting child controls', async () => {
  await renderListing()
  const gallery = document.querySelector('.listing-gallery')
  await act(async () => gallery.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  assert.equal(photo().src, LISTING.imageUrls[1])
  await act(async () => gallery.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
  assert.equal(photo().src, LISTING.imageUrls[0])
  await act(async () => buttonNamed(`Next photo of ${LISTING.title}`).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  assert.equal(photo().src, LISTING.imageUrls[0])
})

test('empty and single-photo listings do not offer misleading navigation', async () => {
  await renderListing([])
  assert.match(document.body.textContent, /No photos provided/)
  assert.equal(document.querySelector('img'), null)
  assert.equal(document.querySelector('button'), null)
  await renderListing([LISTING.imageUrls[0]])
  assert.equal(photo().src, LISTING.imageUrls[0])
  assert.match(document.body.textContent, /Photo 1 of 1/)
  assert.equal(document.querySelector('button'), null)
})

test('failed photos show safe feedback, retry and allow browsing other photos', async () => {
  await renderListing()
  await act(async () => photo().dispatchEvent(new window.Event('error')))
  assert.equal(photo(), null)
  assert.match(document.body.textContent, /Photo unavailable/)
  await click(`Next photo of ${LISTING.title}`)
  assert.equal(photo().src, LISTING.imageUrls[1])
  await click(`Previous photo of ${LISTING.title}`)
  assert.equal(photo(), null)
  await click('Retry photo')
  assert.equal(photo().src, LISTING.imageUrls[0])
  await act(async () => photo().dispatchEvent(new window.Event('load')))
  assert.doesNotMatch(document.body.textContent, /Photo unavailable|Loading photo/)
})

test('updated listing photo URLs reset selection and previous failure state', async () => {
  await renderListing()
  await click(`Show photo 3 of ${LISTING.title}`)
  await act(async () => photo().dispatchEvent(new window.Event('error')))
  await renderListing([LISTING.imageUrls[0], LISTING.imageUrls[2]])
  assert.equal(photo().src, LISTING.imageUrls[0])
  await click(`Next photo of ${LISTING.title}`)
  assert.equal(photo().src, LISTING.imageUrls[2])
})

async function swipe(start, end, isCancelled = false, touchCount = 1) {
  const stage = document.querySelector('.listing-photo-stage')
  const startEvent = new window.Event('touchstart', { bubbles: true })
  Object.defineProperty(startEvent, 'touches', { value: Array(touchCount).fill({ clientX: start.x, clientY: start.y }) })
  const endEvent = new window.Event(isCancelled ? 'touchcancel' : 'touchend', { bubbles: true })
  Object.defineProperty(endEvent, 'changedTouches', { value: [{ clientX: end.x, clientY: end.y }] })
  await act(async () => {
    stage.dispatchEvent(startEvent)
    stage.dispatchEvent(endEvent)
  })
}

test('horizontal swipe browses; vertical scroll, small movements, cancellation and pinch do not', async () => {
  await renderListing()
  await swipe({ x: 200, y: 100 }, { x: 100, y: 110 })
  assert.equal(photo().src, LISTING.imageUrls[1])
  await swipe({ x: 100, y: 100 }, { x: 200, y: 100 })
  assert.equal(photo().src, LISTING.imageUrls[0])
  await swipe({ x: 200, y: 100 }, { x: 130, y: 300 })
  await swipe({ x: 200, y: 100 }, { x: 175, y: 100 })
  await swipe({ x: 200, y: 100 }, { x: 100, y: 100 }, true)
  await swipe({ x: 200, y: 100 }, { x: 100, y: 100 }, false, 2)
  assert.equal(photo().src, LISTING.imageUrls[0])
})
