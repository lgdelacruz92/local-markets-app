import assert from 'node:assert/strict'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { LISTING } from './fixtures/listings.js'

const server = await preview({ preview: { host: '127.0.0.1', port: 4175, strictPort: true } })
let browser
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  const pageErrors = []
  const patches = []
  let sessionUser = { id: LISTING.seller.id, displayName: 'Fixture owner' }
  let sessionMode = 'ready'
  let listing = LISTING
  let patchMode = 'pending'
  let listMode = 'ready'
  let listRequests = 0
  let pendingPatch
  let pendingSession
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/api/session', route => {
    if (sessionMode === 'pending') { pendingSession = route; return }
    if (sessionMode === 'error') return route.fulfill({ status: 503, json: {} })
    return route.fulfill({ json: { user: sessionUser, csrfToken: 'fixture-csrf' } })
  })
  await page.route('https://images.example.test/**', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>',
  }))
  await page.route('**/api/listings', route => {
    listRequests += 1
    if (listMode === 'error') return route.fulfill({ status: 503, json: {} })
    return route.fulfill({ json: { items: listing.status === 'sold' ? [] : [listing] } })
  })
  await page.route('**/api/listings/*', route => {
    const request = route.request()
    if (request.method() === 'GET') return route.fulfill({ json: { listing } })
    patches.push({ method: request.method(), body: request.postDataJSON(), headers: request.headers(), url: request.url() })
    if (patchMode === 'pending') { pendingPatch = route; return }
    if (patchMode === 'network') return route.abort()
    if (typeof patchMode === 'number') return route.fulfill({ status: patchMode,
      json: { error: { code: 'FIXTURE_FAILURE', message: 'Untrusted fixture detail' } } })
    if (patchMode === 'malformed') return route.fulfill({ json: { listing: { ...LISTING, id: 'wrong', status: 'sold' } } })
    listing = { ...LISTING, status: 'sold' }
    return route.fulfill({ json: { listing } })
  })

  async function openDetail() {
    await page.goto('http://127.0.0.1:4175/listings/fixture-chair')
    await page.getByText(`Status: ${listing.status === 'sold' ? 'Sold' : 'Available'}`, { exact: true }).waitFor()
    // Both contracted initial reads must settle before counting mutation refreshes.
    await page.waitForLoadState('networkidle')
  }

  for (const user of [null, { id: 'not-owner', displayName: 'Other user' }]) {
    sessionUser = user
    await openDetail()
    assert.equal(await page.getByRole('button', { name: 'Mark as sold' }).count(), 0)
  }
  sessionUser = { id: LISTING.seller.id, displayName: 'Fixture owner' }
  sessionMode = 'error'
  await openDetail()
  assert.equal(await page.getByRole('button', { name: 'Mark as sold' }).count(), 0)
  sessionMode = 'pending'
  await page.goto('http://127.0.0.1:4175/listings/fixture-chair')
  await page.getByText('Status: Available', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Mark as sold' }).count(), 0)
  await pendingSession.fulfill({ json: { user: sessionUser, csrfToken: 'fixture-csrf' } })
  sessionMode = 'ready'
  await page.getByRole('button', { name: 'Mark as sold', exact: true }).waitFor()
  await page.waitForLoadState('networkidle')
  console.log('PASS: signed-out/non-owner/loading/failed-session users have no sold control; owner does')

  const beforeRefresh = listRequests
  await page.getByRole('button', { name: 'Mark as sold', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Marking this item sold' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Marking sold…' }).isDisabled(), true)
  assert.equal(await page.getByText('Status: Available', { exact: true }).count(), 1)
  assert.equal(patches.length, 1)
  assert.equal(patches[0].method, 'PATCH')
  assert.equal(new URL(patches[0].url).pathname, '/api/listings/fixture-chair')
  assert.deepEqual(patches[0].body, { status: 'sold' })
  assert.equal(patches[0].headers['x-csrf-token'], 'fixture-csrf')
  assert.equal(patches[0].headers['content-type'], 'application/json')
  listing = { ...LISTING, status: 'sold' }
  await pendingPatch.fulfill({ json: { listing } })
  await page.getByText('Status: Sold', { exact: true }).waitFor()
  await page.getByRole('status').filter({ hasText: /^Item marked sold\.$/ }).waitFor()
  assert.equal(listRequests, beforeRefresh + 1)
  assert.equal(await page.getByRole('button', { name: 'Mark as sold' }).count(), 0)
  await page.getByRole('link', { name: 'Browse listings' }).click()
  await page.getByText(/No listings/).waitFor()
  console.log('PASS: exact CSRF PATCH, disabled pending state, confirmed detail update and available-list refresh/removal')

  for (const failure of [400, 401, 403, 404, 'network', 'malformed']) {
    listing = LISTING
    patchMode = failure
    await openDetail()
    const beforeFailure = listRequests
    await page.getByRole('button', { name: 'Mark as sold', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByText('Status: Available', { exact: true }).count(), 1)
    assert.equal(await page.getByText('Status: Sold', { exact: true }).count(), 0)
    assert.equal(await page.getByRole('status').filter({ hasText: 'Item marked sold' }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Mark as sold', exact: true }).isEnabled(), true)
    assert.equal(listRequests, beforeFailure)
    assert.doesNotMatch(await page.getByRole('alert').innerText(), /Untrusted fixture detail/)
  }
  console.log('PASS: 400/401/403/404/network/malformed failures never claim success or refresh the list, and permit retry')

  patchMode = 'success'
  listMode = 'error'
  await page.getByRole('button', { name: 'Mark as sold', exact: true }).click()
  await page.getByText('Status: Sold', { exact: true }).waitFor()
  await page.getByRole('alert').filter({ hasText: 'available listings could not be refreshed' }).waitFor()
  listMode = 'ready'
  await openDetail()
  assert.equal(await page.getByRole('button', { name: 'Mark as sold' }).count(), 0)
  assert.deepEqual(pageErrors, [])
  console.log('PASS: successful retry, separate post-sale refresh failure, already-sold visibility, no uncaught browser errors')
} finally {
  if (browser) await browser.close()
  await promisify(server.httpServer.close.bind(server.httpServer))()
}
