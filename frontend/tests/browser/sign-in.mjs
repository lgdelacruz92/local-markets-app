import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false, ws: false } })
let browser

function assertNavigationRequest(request, pathname) {
  assert.equal(new URL(request.url()).pathname, pathname)
  assert.equal(request.method(), 'GET')
  assert.equal(request.postData(), null)
  assert.equal(request.isNavigationRequest(), true)
}

async function verifyProviderFlow(page, baseUrl, provider, startStatus, callbackStatus) {
  const providerName = provider === 'google' ? 'Google' : 'Facebook'
  const destination = `https://${provider}.oauth.example.test/authorize`
  const requests = []
  await page.route(`${baseUrl}/api/auth/${provider}/start`, async (route) => {
    requests.push(route.request())
    if (startStatus === 503) {
      await route.fulfill({ status: 503, json: { error: { code: 'UNCONFIGURED', message: 'Provider not configured' } } })
      return
    }
    await route.fulfill({ status: 302, headers: { location: destination } })
  })
  await page.route(destination, (route) => route.fulfill({
    contentType: 'text/html',
    body: `<h1>Test-only ${providerName} provider</h1><a href="${baseUrl}/api/auth/${provider}/callback?state=test-only-state&code=test-only-code">Return to app</a>`,
  }))
  await page.route(`${baseUrl}/api/auth/${provider}/callback?**`, async (route) => {
    requests.push(route.request())
    if (callbackStatus === 302) {
      await route.fulfill({ status: 302, headers: { location: '/' } })
      return
    }
    await route.fulfill({ status: callbackStatus, json: {
      error: { code: 'AUTH_FAILED', message: callbackStatus === 400 ? 'Invalid callback' : 'Sign-in rejected' },
    } })
  })
  await page.goto(baseUrl)
  await page.getByRole('link', { name: `Continue with ${providerName}`, exact: true }).click()
  assertNavigationRequest(requests[0], `/api/auth/${provider}/start`)
  assert.equal(requests.length, 1, 'No preflight fetch or duplicate start')
  await verifyFlowResult(page, baseUrl, provider, destination, startStatus, callbackStatus, requests)
}

async function verifyFlowResult(page, baseUrl, provider, destination, startStatus, callbackStatus, requests) {
  if (startStatus === 503) {
    await page.waitForURL(`${baseUrl}/api/auth/${provider}/start`)
    assert.match(await page.locator('body').textContent(), /Provider not configured/)
    await page.goBack()
  } else {
    await page.waitForURL(destination)
    await page.getByRole('link', { name: 'Return to app' }).click()
    if (callbackStatus === 302) {
      await page.waitForURL(`${baseUrl}/`)
    } else {
      await page.waitForURL(`**/api/auth/${provider}/callback?**`)
      const expectedMessage = callbackStatus === 400 ? /Invalid callback/ : /Sign-in rejected/
      assert.match(await page.locator('body').textContent(), expectedMessage)
      await page.goBack()
      await page.goBack()
    }
    assert.equal(requests.length, 2)
    assertNavigationRequest(requests[1], `/api/auth/${provider}/callback`)
    assert.equal(new URL(requests[1].url()).searchParams.get('state'), 'test-only-state')
  }
  await page.getByRole('heading', { name: 'Sign in to Local Markets' }).waitFor()
  assert.match(await page.locator('#sign-in-help').textContent(), /503.*not configured.*401.*rejected.*400.*invalid/s)
  await page.getByRole('link', { name: 'Continue without signing in' }).click()
  await page.waitForURL(`${baseUrl}/`)
  await page.getByRole('heading', { name: 'Local Markets', exact: true }).waitFor()
}

async function verifyFeedbackFixture(page, baseUrl) {
  await page.goto(`${baseUrl}/tests/fixtures/sign-in.html`)
  const failures = [
    ['Simulate unconfigured provider', /not configured/],
    ['Simulate rejected sign-in', /rejected or cancelled/],
    ['Simulate invalid callback', /invalid or has expired/],
  ]
  for (const [buttonName, expectedMessage] of failures) {
    await page.getByRole('button', { name: buttonName }).click()
    assert.match(await page.getByRole('alert').textContent(), expectedMessage)
    assert.equal(await page.getByRole('link', { name: 'Continue with Google' }).count(), 1)
    assert.equal(await page.getByRole('link', { name: 'Continue with Facebook' }).count(), 1)
    assert.equal(await page.getByRole('link', { name: 'Continue without signing in' }).getAttribute('href'), '/')
  }
  await page.getByRole('button', { name: 'Clear test failure' }).click()
  await page.getByRole('alert').waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await page.getByRole('link', { name: 'Continue without signing in' }).click()
  await page.getByRole('heading', { name: 'Local Markets', exact: true }).waitFor()
}

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
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.route('**/api/session', (route) => route.fulfill({ json: { user: null, csrfToken: 'test-only-token' } }))
    await page.route('**/api/listings', (route) => route.fulfill({ json: { items: [] } }))
    for (const provider of ['google', 'facebook']) {
      for (const [startStatus, callbackStatus] of [[302, 302], [503, null], [302, 400], [302, 401]]) {
        await verifyProviderFlow(page, baseUrl, provider, startStatus, callbackStatus)
      }
    }
    await verifyFeedbackFixture(page, baseUrl)
    assert.deepEqual(pageErrors, [])
    console.log(`PASS ${viewport.width}px: both GET/no-body destinations, external 302 navigation, callback redirect, 503/400/401 responses and recovery, trusted feedback, public browsing, no overflow or page errors`)
    await page.close()
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
