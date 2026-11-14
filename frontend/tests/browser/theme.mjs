import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { LISTING } from '../fixtures/listings.js'

const LISTINGS = [
  { ...LISTING, id: 'seed-chair', imageUrls: ['https://images.unsplash.com/photo-1598300042247-d088f8ab3a91'] },
  { ...LISTING, id: 'seed-bike', title: 'City bicycle', category: 'sports', price: 120, imageUrls: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e'] },
  { ...LISTING, id: 'seed-monitor', title: '24-inch monitor', category: 'electronics', price: 65, imageUrls: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf'] },
  { ...LISTING, id: 'no-photo', title: 'A treasure with a very long title for its next home', imageUrls: [], seller: { ...LISTING.seller, contact: `${'long-contact-'.repeat(12)}@example.test` } },
]

function luminance(color) {
  const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number)
  const linearChannels = channels.map((channel) => {
    const value = channel / 255
    if (value <= 0.04045) return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4
  })
  return linearChannels[0] * 0.2126 + linearChannels[1] * 0.7152 + linearChannels[2] * 0.0722
}

function assertContrast(foreground, background) {
  const foregroundLuminance = luminance(foreground)
  const backgroundLuminance = luminance(background)
  const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)} contrast`)
}

async function verifyTheme(page, width) {
  await page.getByRole('heading', { name: LISTING.title, exact: true }).waitFor()
  await page.locator('.listing-photo').first().scrollIntoViewIfNeeded()
  await page.waitForFunction(() => [...document.querySelectorAll('.listing-photo')].every((image) => image.naturalWidth > 0))
  const styles = await page.evaluate(async () => {
    await document.fonts.load('400 16px Nunito')
    await document.fonts.load('600 32px Fraunces')
    await document.fonts.ready
    const body = getComputedStyle(document.body)
    const heading = getComputedStyle(document.querySelector('#welcome-heading'))
    const grid = getComputedStyle(document.querySelector('.listing-grid'))
    const button = getComputedStyle(document.querySelector('a[href="#listings-heading"].bg-leaf'))
    const description = getComputedStyle(document.querySelector('.listing-card > p'))
    return {
      bodyFont: body.fontFamily, headingFont: heading.fontFamily,
      fontsLoaded: document.fonts.check('400 16px Nunito') && document.fonts.check('600 32px Fraunces'),
      background: body.backgroundColor, foreground: body.color,
      buttonBackground: button.backgroundColor, buttonForeground: button.color,
      muted: description.color, columns: grid.gridTemplateColumns.split(' ').length,
      imageFit: getComputedStyle(document.querySelector('.listing-photo')).objectFit,
      touchAction: getComputedStyle(document.querySelector('.listing-photo-stage')).touchAction,
      hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  assert.match(styles.bodyFont, /Nunito/)
  assert.match(styles.headingFont, /Fraunces/)
  assert.equal(styles.fontsLoaded, true)
  assert.equal(styles.background, 'rgb(255, 250, 242)')
  assertContrast(styles.foreground, styles.background)
  assertContrast(styles.muted, 'rgb(255, 255, 255)')
  assertContrast(styles.muted, styles.background)
  assertContrast(styles.muted, 'rgb(237, 243, 232)')
  assertContrast(styles.foreground, 'rgb(246, 226, 164)')
  assertContrast(styles.foreground, 'rgb(251, 228, 213)')
  assertContrast('rgb(161, 58, 47)', 'rgb(251, 228, 213)')
  assertContrast(styles.buttonForeground, styles.buttonBackground)
  assert.equal(styles.columns, width < 640 ? 1 : width < 1024 ? 2 : 3)
  assert.equal(styles.imageFit, 'contain')
  assert.match(styles.touchAction, /pan-y/)
  assert.match(styles.touchAction, /pinch-zoom/)
  assert.equal(styles.hasOverflow, false)
  await page.getByText('Need help signing in?', { exact: true }).click()
  await page.locator('#sign-in-help').waitFor({ state: 'visible' })
  await page.goto(page.url())
  await page.keyboard.press('Tab')
  assert.equal(await page.getByRole('link', { name: 'Skip to content' }).evaluate((link) => link === document.activeElement), true)
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth)
  assert.equal(outline, '3px')
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content')
  for (const image of await page.locator('.listing-photo').all()) {
    await image.scrollIntoViewIfNeeded()
    await image.evaluate((element) => element.decode())
  }
  await page.evaluate(async () => {
    await document.fonts.ready
    document.activeElement.blur()
    window.scrollTo(0, 0)
  })
  await page.screenshot({ path: `test-results/tailwind-theme-${width}.png`, fullPage: true })
}

const server = await preview({ preview: { host: '127.0.0.1', port: 0 } })
let browser

try {
  const baseUrl = `http://127.0.0.1:${server.httpServer.address().port}`
  await mkdir('test-results', { recursive: true })
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  for (const width of [320, 375, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const pageErrors = []
    const fontResponses = []
    const externalRequests = []
    let isSignedIn = false
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('response', (response) => {
      if (response.url().endsWith('.woff2')) fontResponses.push(response)
    })
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url())
      if (url.origin !== baseUrl) {
        externalRequests.push(url.href)
        return route.abort()
      }
      if (url.pathname === '/api/session') return route.fulfill({ json: { user: isSignedIn ? { id: 'test-user', displayName: 'Friendly Neighbor' } : null, csrfToken: 'test-only-token' } })
      if (url.pathname === '/api/listings') return route.fulfill({ json: { items: LISTINGS } })
      return route.continue()
    })
    await page.goto(baseUrl)
    await verifyTheme(page, width)
    assert.ok(fontResponses.length >= 2, 'Fonts are bundled in the production build')
    assert.ok(fontResponses.every((response) => response.ok()), 'Local fonts load successfully')
    isSignedIn = true
    await page.reload()
    await page.getByText('Signed in as Friendly Neighbor', { exact: true }).waitFor()
    assert.equal(await page.locator('.listing-card').count(), 4)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(externalRequests, [])
    console.log(`PASS ${width}px: production Tailwind layout, bundled fonts/photos, contrast, touch scrolling, help disclosure, keyboard focus/skip link, signed-in layout, long text, no overflow`)
    await page.close()
  }
} finally {
  if (browser) await browser.close()
  await new Promise((resolve, reject) => server.httpServer.close((error) => {
    if (error) reject(error)
    else resolve()
  }))
}
