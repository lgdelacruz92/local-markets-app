import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { LISTING } from '../fixtures/listings.js'

const SIGNED_IN = { user: { id: 'fixture-user', displayName: 'Test Seller' }, csrfToken: 'test-only-token' }
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
    const page = await browser.newPage({ viewport })
    const pageErrors = []
    let isSignedIn = false
    let listingsMode = 'success'
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.route('https://images.example.test/**', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="teal"/></svg>',
    }))
    await page.route('**/api/session', (route) => route.fulfill({
      json: isSignedIn ? SIGNED_IN : { user: null, csrfToken: 'test-only-token' },
    }))
    await page.route('**/api/listings', (route) => {
      assert.equal(route.request().method(), 'GET')
      assert.equal(route.request().postData(), null)
      assert.equal(route.request().headers()['x-csrf-token'], undefined)
      if (listingsMode === 'failure') return route.fulfill({ status: 503, body: 'Private server details' })
      return route.fulfill({ json: { items: listingsMode === 'empty' ? [] : [LISTING] } })
    })
    await page.route('**/api/auth/google/start', (route) => route.fulfill({
      status: 302, headers: { location: 'https://google.oauth.example.test/authorize' },
    }))
    await page.route('https://google.oauth.example.test/authorize', (route) => route.fulfill({
      contentType: 'text/html',
      body: `<a href="${baseUrl}/api/auth/google/callback?state=test-only&code=test-only">Complete test sign-in</a>`,
    }))
    await page.route('**/api/auth/google/callback?**', (route) => {
      isSignedIn = true
      return route.fulfill({ status: 302, headers: { location: '/' } })
    })
    await page.route('**/api/logout', (route) => {
      isSignedIn = false
      return route.fulfill({ status: 204 })
    })

    await page.goto(baseUrl)
    await page.getByRole('heading', { name: LISTING.title, exact: true }).waitFor()
    await page.getByRole('link', { name: 'Continue with Google', exact: true }).click()
    await page.getByRole('link', { name: 'Complete test sign-in' }).click()
    await page.getByText('Signed in as Test Seller', { exact: true }).waitFor()
    await page.getByRole('heading', { name: LISTING.title, exact: true }).waitFor()
    await page.locator('.listing-photo').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => document.querySelector('.listing-photo')?.naturalWidth > 0)
    assert.equal(await page.locator('.listing-photo').getAttribute('src'), LISTING.imageUrls[0])
    assert.equal(await page.getByRole('heading', { name: 'Sign in to Local Markets' }).count(), 0)
    await page.reload()
    await page.getByRole('heading', { name: LISTING.title, exact: true }).waitFor()
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    await page.getByRole('heading', { name: 'Sign in to Local Markets' }).waitFor()
    assert.equal(await page.getByRole('heading', { name: LISTING.title, exact: true }).count(), 1)

    listingsMode = 'failure'
    await page.reload()
    await page.getByRole('alert').filter({ hasText: 'Unable to load listings' }).waitFor()
    assert.doesNotMatch(await page.locator('body').textContent(), /Private server details/)
    listingsMode = 'success'
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await page.getByRole('heading', { name: LISTING.title, exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    listingsMode = 'empty'
    await page.reload()
    await page.getByText('No listings are available yet. Check back soon.', { exact: true }).waitFor()
    assert.deepEqual(pageErrors, [])
    console.log(`PASS ${viewport.width}px: anonymous browse, callback return, signed-in reload, logout, failure/retry, empty state, no overflow or page errors`)
    await page.close()
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
