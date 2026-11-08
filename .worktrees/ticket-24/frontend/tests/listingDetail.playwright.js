import assert from 'node:assert/strict'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { LISTING } from './fixtures/listings.js'

const server = await preview({ preview: { host: '127.0.0.1', port: 4174, strictPort: true } })
let browser
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const pageErrors = []
  const requests = []
  const pendingRoutes = []
  let mode = 'loading'
  let listing = { ...LISTING, imageUrls: [...LISTING.imageUrls, 'https://images.example.test/second.jpg'] }
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/api/session', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Fixture' } } }))
  await page.route('**/api/listings', route => route.fulfill({ json: { items: [LISTING] } }))
  await page.route('https://images.example.test/**', route => {
    if (route.request().url().endsWith('broken.jpg')) return route.abort()
    return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#bdd3c3"/></svg>' })
  })
  await page.route('**/api/listings/*', async route => {
    const request = route.request()
    requests.push({ method: request.method(), body: request.postData(), url: request.url() })
    if (mode === 'loading') { pendingRoutes.push(route); return }
    if (mode === 'missing') {
      await route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Fixture' } } })
      return
    }
    if (mode === 'error') {
      await route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Fixture' } } })
      return
    }
    if (mode === 'offline') { await route.abort(); return }
    await route.fulfill({ json: { listing } })
  })

  await page.goto('http://127.0.0.1:4174/')
  await page.getByRole('link', { name: /Oak dining chair/ }).click()
  await page.getByRole('status').filter({ hasText: 'Loading listing' }).waitFor()
  assert.equal(new URL(page.url()).pathname, '/listings/fixture-chair')
  assert.equal(new URL(requests[0].url).pathname, '/api/listings/fixture-chair')
  assert.equal(requests[0].method, 'GET')
  assert.equal(requests[0].body, null)
  mode = 'success'
  for (const route of pendingRoutes) await route.fulfill({ json: { listing } })
  await page.getByRole('heading', { name: LISTING.title, exact: true }).waitFor()
  const details = await page.locator('article').innerText()
  for (const field of ['35.5 USD', LISTING.description, LISTING.category, LISTING.locality,
    LISTING.seller.displayName, LISTING.seller.contact, 'Status: Available']) assert.ok(details.includes(field), field)
  assert.equal(await page.getByRole('img').count(), 2)
  await page.getByRole('img').first().evaluate(image => image.decode())
  const desktop = await page.locator('.detail-layout').evaluate(layout => {
    const photos = layout.children[0].getBoundingClientRect()
    const information = layout.children[1].getBoundingClientRect()
    return information.x > photos.x && Math.abs(information.y - photos.y) < 1
  })
  assert.equal(desktop, true)
  console.log('PASS: card opens by ID, visible loading, all fields/photos and available status, desktop layout without login')

  listing = { ...listing, status: 'sold', price: 0, currency: 'EUR' }
  await page.getByRole('button', { name: 'Refresh listing' }).click()
  await page.getByText('Status: Sold', { exact: true }).waitFor()
  assert.match(await page.locator('.detail-price').innerText(), /0 EUR/)
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 812 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    assert.equal(await page.locator('.detail-layout').evaluate(layout => {
      const photos = layout.children[0].getBoundingClientRect()
      const information = layout.children[1].getBoundingClientRect()
      return information.y > photos.y && information.x === photos.x
    }), true)
  }
  console.log('PASS: refetch shows sold/free price, mobile stacked layout and no overflow at 375px/320px')

  mode = 'missing'
  await page.goto('http://127.0.0.1:4174/listings/missing-id')
  await page.getByRole('heading', { name: 'Listing not found' }).waitFor()
  assert.equal(await page.locator('article').count(), 0)
  assert.equal(new URL(requests.at(-1).url).pathname, '/api/listings/missing-id')
  mode = 'error'
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.getByRole('alert').waitFor()
  assert.match(await page.getByRole('alert').innerText(), /Unable to load/)
  mode = 'offline'
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.getByRole('alert').waitFor()
  mode = 'success'
  await page.goto('http://127.0.0.1:4174/listings/fixture-chair')
  await page.getByText('Status: Sold', { exact: true }).waitFor()
  listing = { ...listing, imageUrls: [] }
  await page.getByRole('button', { name: 'Refresh listing' }).click()
  await page.getByText('No photos available', { exact: true }).waitFor()
  listing = { ...listing, imageUrls: ['https://images.example.test/broken.jpg'] }
  await page.getByRole('button', { name: 'Refresh listing' }).click()
  await page.getByText('Photo unavailable', { exact: true }).waitFor()
  await page.getByRole('link', { name: 'Browse listings' }).click()
  await page.getByRole('heading', { name: 'Available listings' }).waitFor()
  assert.deepEqual(pageErrors, [])
  console.log('PASS: direct public route, missing/HTTP/network errors, recovery, empty/broken photos, browse navigation and no uncaught browser errors')
} finally {
  if (browser) await browser.close()
  await promisify(server.httpServer.close.bind(server.httpServer))()
}
