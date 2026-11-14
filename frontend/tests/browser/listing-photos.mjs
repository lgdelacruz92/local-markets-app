import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { LISTING } from '../fixtures/listings.js'

const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, ws: false } })
let browser

try {
  await server.listen()
  const baseUrl = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    const page = await browser.newPage({ viewport, hasTouch: true })
    const pageErrors = []
    let shouldFail = false
    let shouldDelay = false
    let delayedRoute
    let galleryUrls = LISTING.imageUrls
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.route('**/api/session', (route) => route.fulfill({
      json: { user: { id: 'fixture-user', displayName: 'Test Seller' }, csrfToken: 'test-only-token' },
    }))
    await page.route('**/api/listings', (route) => route.fulfill({ json: { items: [
      { ...LISTING, imageUrls: galleryUrls },
      { ...LISTING, id: 'no-photos', title: 'No-photo listing', imageUrls: [] },
      { ...LISTING, id: 'one-photo', title: 'Single-photo listing', imageUrls: [LISTING.imageUrls[0]] },
    ] } }))
    const imageBody = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="teal"/></svg>'
    await page.context().route('https://images.example.test/**', (route) => {
      if (shouldDelay && route.request().url().endsWith('/delayed.svg')) {
        delayedRoute = route
        return
      }
      if (shouldFail && route.request().url().endsWith('/missing.svg')) {
        return route.fulfill({ status: 404, body: 'Missing photo fixture' })
      }
      return route.fulfill({ contentType: 'image/svg+xml', body: imageBody })
    })

    await page.goto(baseUrl)
    const gallery = page.getByRole('region', { name: `Photos of ${LISTING.title}`, exact: true })
    const photo = gallery.locator('.listing-photo')
    await gallery.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => document.querySelector('.listing-photo')?.naturalWidth > 0)
    assert.equal(await photo.getAttribute('src'), LISTING.imageUrls[0])
    await gallery.getByRole('button', { name: `Next photo of ${LISTING.title}`, exact: true }).click()
    assert.equal(await photo.getAttribute('src'), LISTING.imageUrls[1])
    await gallery.getByRole('button', { name: `Show photo 3 of ${LISTING.title}`, exact: true }).click()
    assert.equal(await photo.getAttribute('src'), LISTING.imageUrls[2])
    await gallery.getByRole('button', { name: `Next photo of ${LISTING.title}`, exact: true }).click()
    assert.equal(await photo.getAttribute('src'), LISTING.imageUrls[0])
    await gallery.focus()
    await page.keyboard.press('ArrowLeft')
    assert.equal(await photo.getAttribute('src'), LISTING.imageUrls[2])
    await page.keyboard.press('ArrowRight')
    assert.equal(await photo.getAttribute('src'), LISTING.imageUrls[0])
    await gallery.locator('.listing-photo-stage').evaluate((stage) => {
      const start = new Touch({ identifier: 1, target: stage, clientX: 250, clientY: 100 })
      const end = new Touch({ identifier: 1, target: stage, clientX: 100, clientY: 105 })
      stage.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start] }))
      stage.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] }))
    })
    assert.equal(await photo.getAttribute('src'), LISTING.imageUrls[1])
    const fullSizeLink = gallery.getByRole('link', { name: 'Open full-size photo (new tab)' })
    assert.equal(await fullSizeLink.getAttribute('href'), LISTING.imageUrls[1])
    // noopener deliberately detaches the new tab from the original page.
    const popupPromise = page.context().waitForEvent('page')
    await fullSizeLink.click()
    const popup = await popupPromise
    await popup.waitForLoadState()
    assert.equal(popup.url(), LISTING.imageUrls[1])
    await popup.close()
    await page.getByText('No photos provided', { exact: true }).waitFor()
    const single = page.getByRole('region', { name: 'Photos of Single-photo listing', exact: true })
    assert.equal(await single.getByRole('button').count(), 0)
    await single.getByText('Photo 1 of 1', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)

    // Fresh URLs avoid browser image caching when verifying failure and retry.
    galleryUrls = ['https://images.example.test/missing.svg', LISTING.imageUrls[1]]
    shouldFail = true
    await page.reload()
    await gallery.scrollIntoViewIfNeeded()
    await gallery.getByText('Photo unavailable.', { exact: false }).waitFor()
    assert.equal(await gallery.locator('.listing-photo').count(), 0)
    await gallery.getByRole('button', { name: `Next photo of ${LISTING.title}`, exact: true }).click()
    await gallery.getByText('Photo 2 of 2', { exact: true }).waitFor()
    await page.waitForFunction(() => document.querySelector('.listing-photo')?.naturalWidth > 0)
    await gallery.getByRole('button', { name: `Previous photo of ${LISTING.title}`, exact: true }).click()
    shouldFail = false
    await gallery.getByRole('button', { name: 'Retry photo', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.listing-photo')?.naturalWidth > 0)

    galleryUrls = ['https://images.example.test/delayed.svg']
    shouldDelay = true
    const photoRequest = page.waitForRequest('https://images.example.test/delayed.svg')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await gallery.scrollIntoViewIfNeeded()
    await gallery.getByText('Loading photo…', { exact: true }).waitFor()
    await photoRequest
    shouldDelay = false
    await delayedRoute.fulfill({ contentType: 'image/svg+xml', body: imageBody })
    await page.waitForFunction(() => document.querySelector('.listing-photo')?.naturalWidth > 0)
    assert.equal(await gallery.getByText('Loading photo…', { exact: true }).count(), 0)
    assert.deepEqual(pageErrors, [])
    console.log(`PASS ${viewport.width}px: loaded photos, navigation, thumbnails, keyboard, synthetic swipe, full-size view, empty/single photos, failure/retry, loading, no overflow`)
    await page.close()
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
