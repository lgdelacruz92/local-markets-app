import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const SIGNED_IN = { user: { id: 'fixture-user', displayName: 'Test Seller' }, csrfToken: 'test-only-token' }
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, ws: false } })
let browser

try {
  await server.listen()
  const address = server.httpServer.address()
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    const page = await browser.newPage({ viewport })
    const pageErrors = []
    const logoutRequests = []
    let pendingRoute
    let responseMode = 'pending'
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.route('**/api/session', (route) => route.fulfill({ json: SIGNED_IN }))
    await page.route('**/api/logout', async (route) => {
      logoutRequests.push(route.request())
      if (responseMode === 'network') {
        await route.abort('failed')
      } else {
        pendingRoute = route
      }
    })
    await page.goto(`http://127.0.0.1:${address.port}/`)
    await page.getByText('Signed in as Test Seller', { exact: true }).waitFor()
    const firstRequest = page.waitForRequest('**/api/logout')
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    await firstRequest
    await page.getByRole('status').waitFor()
    assert.equal(logoutRequests.length, 1)
    assert.equal(logoutRequests[0].method(), 'POST')
    assert.equal(logoutRequests[0].headers()['x-csrf-token'], SIGNED_IN.csrfToken)
    assert.equal(logoutRequests[0].postData(), null)
    assert.equal(await page.getByRole('button', { name: 'Logging out…', exact: true }).isDisabled(), true)
    assert.equal(await page.getByText('Signed in as Test Seller', { exact: true }).count(), 1)
    await pendingRoute.fulfill({
      status: 403, json: { error: { code: 'INVALID_CSRF', message: 'Invalid CSRF token' } },
    })
    await page.getByRole('alert').waitFor()
    assert.match(await page.getByRole('alert').textContent(), /security check/)
    assert.equal(await page.getByRole('button', { name: 'Log out', exact: true }).isEnabled(), true)
    assert.equal(await page.getByText('Signed in as Test Seller', { exact: true }).count(), 1)

    responseMode = 'network'
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Check your connection' }).waitFor()
    assert.equal(await page.getByText('Signed in as Test Seller', { exact: true }).count(), 1)
    assert.equal(await page.getByRole('button', { name: 'Log out', exact: true }).isEnabled(), true)

    responseMode = 'pending'
    const retryRequest = page.waitForRequest('**/api/logout')
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    await retryRequest
    await page.getByRole('status').waitFor()
    assert.equal(logoutRequests.length, 3)
    await pendingRoute.fulfill({ status: 204 })
    await page.getByRole('region', { name: 'Signed-in account' }).waitFor({ state: 'detached' })
    assert.equal(await page.getByText('Signed in as Test Seller', { exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Log out', exact: true }).count(), 0)
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    assert.deepEqual(pageErrors, [])
    console.log(`PASS ${viewport.width}px: POST/header/no body, pending, 403/network retention, retry, 204 reset, no overflow or page errors`)
    await page.close()
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
