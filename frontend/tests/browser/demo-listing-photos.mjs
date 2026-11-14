import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { createApp } from '../../../backend/listings/dist/app.js'
import { FileListingStore } from '../../../backend/listings/dist/store.js'

// Exercise the real API and built assets, including an already-persisted seed store.
const temporaryDirectory = await mkdtemp(join(process.cwd(), '.demo-photos-test-'))
let apiServer
let frontendServer
let browser

try {
  const filePath = join(temporaryDirectory, 'listings.json')
  await FileListingStore.open(filePath)
  // Reproduce persisted CDN variants missed by exact-string demo matching.
  const listings = JSON.parse(await readFile(filePath, 'utf8'))
  const suffixes = ['?auto=format&fit=crop&w=800&q=80', '#photo', '?w=1200#photo', '']
  for (const [index, listing] of listings.entries()) {
    listing.imageUrls = listing.imageUrls.map((url) => `${url}${suffixes[index]}`)
  }
  await writeFile(filePath, `${JSON.stringify(listings, null, 2)}\n`)
  const persistedData = await readFile(filePath, 'utf8')
  const repository = await FileListingStore.open(filePath)
  apiServer = createApp(repository).listen(0, '127.0.0.1')
  await once(apiServer, 'listening')
  frontendServer = await preview({ preview: {
    host: '127.0.0.1', port: 0,
    proxy: { '/api/listings': `http://127.0.0.1:${apiServer.address().port}` },
  } })
  const baseUrl = `http://127.0.0.1:${frontendServer.httpServer.address().port}`
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    for (const isSignedIn of [false, true]) {
      const page = await browser.newPage({ viewport })
      const externalRequests = []
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      await page.route('**/*', (route) => {
        if (new URL(route.request().url()).origin !== baseUrl) {
          externalRequests.push(route.request().url())
          return route.abort()
        }
        return route.continue()
      })
      await page.route('**/api/session', (route) => route.fulfill({ json: {
        user: isSignedIn ? { id: 'test-user', displayName: 'Test Seller' } : null,
        csrfToken: 'test-only-token',
      } }))
      await page.goto(baseUrl)
      await page.locator('.listing-card').first().waitFor()
      assert.equal(await page.locator('.listing-card').count(), 3)
      for (const gallery of await page.locator('.listing-gallery').all()) {
        await gallery.scrollIntoViewIfNeeded()
        await gallery.locator('.listing-photo').evaluate(async (image) => {
          await image.decode()
          if (image.naturalWidth === 0) throw new Error('Demo photo did not decode')
        })
        const imageUrl = await gallery.locator('.listing-photo').getAttribute('src')
        assert.ok(imageUrl.startsWith('/demo-listings/'))
        assert.equal(await gallery.getByRole('link').getAttribute('href'), imageUrl)
      }
      assert.equal(await page.getByText('Photo unavailable.', { exact: false }).count(), 0)
      assert.equal(await page.getByRole('link', { name: 'Photo credits', exact: true }).count(), 3)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)

      const fullSizeLink = page.locator('.listing-gallery').first().getByRole('link')
      const fullSizeUrl = await fullSizeLink.getAttribute('href')
      const popupPromise = page.context().waitForEvent('page')
      await fullSizeLink.click()
      const popup = await popupPromise
      await popup.waitForLoadState()
      assert.equal(popup.url(), `${baseUrl}${fullSizeUrl}`)
      await popup.locator('img').evaluate(async (image) => { await image.decode() })
      await popup.close()

      await page.getByRole('link', { name: 'Photo credits', exact: true }).first().click()
      assert.equal(page.url(), `${baseUrl}/demo-listings/credits.html`)
      for (const photoUrl of ['/demo-listings/chair.jpg', '/demo-listings/bicycle.jpg', '/demo-listings/monitor.png', '/demo-listings/table.jpg']) {
        const response = await page.request.get(`${baseUrl}${photoUrl}`)
        assert.equal(response.status(), 200)
        assert.match(response.headers()['content-type'], /^image\//)
        await page.evaluate(async (url) => {
          const image = new Image()
          image.src = url
          await image.decode()
          if (image.naturalWidth === 0) throw new Error('Bundled full-size photo did not decode')
        }, photoUrl)
      }
      assert.deepEqual(externalRequests, [])
      assert.deepEqual(pageErrors, [])
      console.log(`PASS ${viewport.width}px, signed-in=${isSignedIn}: real persisted API listings, production photo decoding, full-size targets, credits, no external requests or overflow`)
      await page.close()
    }
  }
  assert.equal(await readFile(filePath, 'utf8'), persistedData)
  console.log('PASS: persisted listings were not changed or reseeded')
} finally {
  if (browser) await browser.close()
  if (frontendServer) await new Promise((resolve, reject) => frontendServer.httpServer.close((error) => error ? reject(error) : resolve()))
  if (apiServer) await new Promise((resolve, reject) => apiServer.close((error) => error ? reject(error) : resolve()))
  await rm(temporaryDirectory, { recursive: true, force: true })
}
