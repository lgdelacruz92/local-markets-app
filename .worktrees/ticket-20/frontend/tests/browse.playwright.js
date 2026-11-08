import assert from 'node:assert/strict'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { LISTINGS } from './fixtures/listings.js'

const items = [...LISTINGS, ...LISTINGS.map(listing => ({ ...listing, id: `${listing.id}-second` }))]
const server = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: true } })
let browser

try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const pageErrors = []
  const requests = []
  const pendingRoutes = []
  let mode = 'loading'
  let responseItems = items
  page.on('pageerror', error => pageErrors.push(error.message))

  // A failed session check must never prevent public browsing.
  await page.route('**/api/session', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Test-only session failure' } } }))
  await page.route('https://images.example.test/**', route => {
    if (route.request().url().endsWith('/broken.jpg')) return route.abort()
    return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#bdd3c3"/><text x="100" y="250" font-size="40">Test-only photo</text></svg>' })
  })
  await page.route('**/api/listings*', async route => {
    const request = route.request()
    requests.push({ method: request.method(), body: request.postData(), url: request.url() })
    if (mode === 'loading') {
      pendingRoutes.push(route)
      return
    }
    if (mode === 'error') {
      await route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Test-only failure' } } })
      return
    }
    await route.fulfill({ json: { items: mode === 'empty' ? [] : responseItems } })
  })

  await page.goto('http://127.0.0.1:4173/')
  await page.getByRole('status').filter({ hasText: 'Loading available listings' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Refresh listings' }).isDisabled(), true)
  assert.equal(requests[0].method, 'GET')
  assert.equal(requests[0].body, null)
  assert.equal(new URL(requests[0].url).pathname, '/api/listings')
  mode = 'success'
  for (const route of pendingRoutes) await route.fulfill({ json: { items } })
  await page.locator('.listing-card').nth(5).waitFor()
  await page.locator('.listing-card').nth(2).getByText('No photo available').waitFor()
  assert.equal(await page.locator('.listing-card').count(), 6)
  assert.match(await page.locator('.listing-card').first().innerText(), /35\.5 USD/)
  assert.equal(await page.locator('.listing-card').first().getByRole('heading').innerText(), 'Oak dining chair')
  assert.equal(await page.locator('.listing-locality').first().innerText(), 'Northside')
  assert.equal(await page.locator('.listing-link').first().getAttribute('href'), '/listings/fixture-chair')
  assert.equal(await page.locator('img').first().evaluate(image => image.complete && image.naturalWidth > 0), true)

  const desktopCards = await page.locator('.listing-card').evaluateAll(cards => cards.map(card => {
    const { x, y, width } = card.getBoundingClientRect()
    return { x, y, width }
  }))
  assert.equal(desktopCards[0].y, desktopCards[3].y)
  assert.ok(desktopCards[4].y > desktopCards[0].y)
  await page.getByRole('button', { name: 'Refresh listings' }).focus()
  await page.keyboard.press('Tab')
  assert.equal(await page.locator('.listing-link').first().evaluate(link => link === document.activeElement), true)
  await page.screenshot({ path: 'test-results/browse-desktop.png', fullPage: true })
  console.log('PASS: public fetching, loading, representative cards/photos/fallbacks, desktop grid and keyboard access')

  await page.setViewportSize({ width: 375, height: 812 })
  const mobileCards = await page.locator('.listing-card').evaluateAll(cards => cards.map(card => {
    const { x, y, width } = card.getBoundingClientRect()
    return { x, y, width }
  }))
  assert.equal(mobileCards[0].x, mobileCards[1].x)
  assert.ok(mobileCards[1].y > mobileCards[0].y)
  assert.ok(mobileCards[0].width <= 375)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await page.screenshot({ path: 'test-results/browse-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 320, height: 640 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  console.log('PASS: mobile single-column grid and no overflow at 375px/320px')

  mode = 'empty'
  await page.getByRole('button', { name: 'Refresh listings' }).click()
  await page.getByRole('heading', { name: 'No listings yet' }).waitFor()
  assert.equal(await page.locator('.listing-card').count(), 0)
  console.log('PASS: empty state')

  mode = 'error'
  await page.getByRole('button', { name: 'Refresh listings' }).click()
  await page.getByRole('alert').waitFor()
  assert.match(await page.getByRole('alert').innerText(), /Unable to load listings/)
  mode = 'success'
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.locator('.listing-card').nth(5).waitFor()
  assert.equal(await page.getByRole('alert').count(), 0)
  assert.deepEqual(pageErrors, [])
  console.log('PASS: failed request, successful retry, and no uncaught browser errors')

  function assertLatestFilters(expected) {
    const request = requests.at(-1)
    const url = new URL(request.url)
    assert.deepEqual(Object.fromEntries(url.searchParams), expected)
    assert.equal(request.method, 'GET')
    assert.equal(request.body, null)
  }

  async function clickAndWait(name) {
    await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/api/listings'),
      page.getByRole('button', { name, exact: true }).click(),
    ])
  }

  // Deliberately return a non-matching item to prove the grid uses server results.
  responseItems = [LISTINGS[1]]
  await page.setViewportSize({ width: 1280, height: 900 })
  assert.deepEqual(await page.locator('datalist option').evaluateAll(options => options.map(option => option.value)),
    ['Books', 'Furniture', 'Sports & Outdoors'])
  const individualFilters = [
    { label: 'Search', key: 'q', value: 'Chair & lamp + #1?' },
    { label: 'Locality', key: 'locality', value: 'São José / North' },
    { label: 'Category', key: 'category', value: 'Furniture' },
  ]
  for (const filter of individualFilters) {
    await page.getByLabel(filter.label, { exact: true }).fill(filter.value)
    await clickAndWait('Apply filters')
    await page.getByRole('heading', { name: LISTINGS[1].title }).waitFor()
    assertLatestFilters({ [filter.key]: filter.value })
    assert.equal(await page.locator('.listing-card').count(), 1)
    await clickAndWait('Clear filters')
    assertLatestFilters({})
  }
  console.log('PASS: each filter sends exact encoded values and renders server-returned fixtures')

  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByLabel('Search', { exact: true }).fill('  chair  ')
    await page.getByLabel('Locality', { exact: true }).fill(' Northside ')
    await page.getByLabel('Category', { exact: true }).fill('Furniture')
    await page.getByRole('button', { name: 'Apply filters', exact: true }).focus()
    await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/api/listings'),
      page.keyboard.press('Enter'),
    ])
    await page.getByRole('heading', { name: LISTINGS[1].title }).waitFor()
    assertLatestFilters({ q: 'chair', locality: 'Northside', category: 'Furniture' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    const inputPositions = await page.locator('.listing-filters input').evaluateAll(inputs =>
      inputs.map(input => ({ top: input.getBoundingClientRect().top, height: input.getBoundingClientRect().height })))
    for (const position of inputPositions) assert.ok(position.height >= 44)
    if (width === 1280) assert.equal(inputPositions[0].top, inputPositions[2].top)
    else assert.ok(inputPositions[0].top < inputPositions[1].top && inputPositions[1].top < inputPositions[2].top)
    await page.screenshot({ path: `test-results/filters-${width}.png`, fullPage: true })
    responseItems = items
    await clickAndWait('Clear filters')
    await page.locator('.listing-card').nth(5).waitFor()
    assertLatestFilters({})
    for (const label of ['Search', 'Locality', 'Category']) {
      assert.equal(await page.getByLabel(label, { exact: true }).inputValue(), '')
    }
    responseItems = [LISTINGS[1]]
  }
  console.log('PASS: combined filters, keyboard submit, clear controls and result updates at desktop/375px/320px')

  await page.getByLabel('Search', { exact: true }).fill('   ')
  await page.getByLabel('Locality', { exact: true }).fill('   ')
  await page.getByLabel('Category', { exact: true }).fill('   ')
  await clickAndWait('Apply filters')
  assertLatestFilters({})
  await clickAndWait('Clear filters')
  console.log('PASS: applying blank inputs permits unfiltered browsing')

  await page.getByLabel('Search', { exact: true }).fill('missing item')
  mode = 'empty'
  await clickAndWait('Apply filters')
  await page.getByRole('heading', { name: 'No listings yet' }).waitFor()
  assertLatestFilters({ q: 'missing item' })
  // Unsaved edits must not change applied filters on refresh or error retry.
  await page.getByLabel('Search', { exact: true }).fill('unsaved draft')
  mode = 'error'
  await clickAndWait('Refresh listings')
  await page.getByRole('alert').waitFor()
  assertLatestFilters({ q: 'missing item' })
  mode = 'success'
  await clickAndWait('Try again')
  await page.getByRole('heading', { name: LISTINGS[1].title }).waitFor()
  assertLatestFilters({ q: 'missing item' })
  console.log('PASS: filtered empty/error states reuse shared grid; refresh/retry retain applied values')

  mode = 'loading'
  pendingRoutes.length = 0
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Loading available listings' }).waitFor()
  assertLatestFilters({ q: 'unsaved draft' })
  mode = 'success'
  responseItems = items
  await clickAndWait('Clear filters')
  await page.locator('.listing-card').nth(5).waitFor()
  assertLatestFilters({})
  for (const route of pendingRoutes) await route.fulfill({ json: { items: [] } })
  assert.equal(await page.locator('.listing-card').count(), 6)
  assert.deepEqual(pageErrors, [])
  console.log('PASS: clear while loading replaces pending filtered results without stale overwrites')
} finally {
  if (browser) await browser.close()
  await promisify(server.httpServer.close.bind(server.httpServer))()
}
