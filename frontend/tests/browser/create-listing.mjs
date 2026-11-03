import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'

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
    const writes = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('request', (request) => {
      if (request.method() !== 'GET') writes.push(request.url())
    })
    await page.goto(`http://127.0.0.1:${address.port}/tests/fixtures/create-listing.html`)
    await page.getByRole('button', { name: 'Create listing', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.locator('[aria-invalid="true"]').count(), 7)
    assert.equal(await page.evaluate(() => window.submissionCount ?? 0), 0)

    const fields = {
      title: ' Desk ', description: ' Solid wood ', price: '-1', currency: 'usd',
      category: 'Furniture', locality: 'Downtown',
      imageUrls: 'https://example.com/desk.jpg\n\nhttp://example.com/side.jpg', contact: 'public@example.com',
    }
    for (const [name, value] of Object.entries(fields)) await page.locator(`[name="${name}"]`).fill(value)
    for (const price of ['-1', 'not a number']) {
      await page.locator('[name="price"]').fill(price)
      await page.getByRole('button', { name: 'Create listing', exact: true }).click()
      await page.getByText('Enter a valid price of zero or more.', { exact: true }).waitFor()
      assert.match(await page.locator('#listing-price-error').textContent(), /zero or more/)
      assert.equal(await page.evaluate(() => window.submissionCount ?? 0), 0)
    }
    await page.locator('[name="price"]').fill('0')
    await page.locator('[name="imageUrls"]').fill('javascript:alert(1)')
    await page.getByRole('button', { name: 'Create listing', exact: true }).click()
    await page.locator('#listing-imageUrls-error').waitFor()
    assert.match(await page.locator('#listing-imageUrls-error').textContent(), /HTTP or HTTPS/)
    await page.locator('[name="imageUrls"]').fill(fields.imageUrls)
    await page.getByRole('button', { name: 'Create listing', exact: true }).click()
    await page.getByRole('status').waitFor()
    assert.equal(await page.locator('[name="title"]').isDisabled(), true)
    assert.deepEqual(await page.evaluate(() => window.submittedValues), {
      title: 'Desk', description: 'Solid wood', price: 0, currency: 'USD', category: 'Furniture',
      locality: 'Downtown', imageUrls: ['https://example.com/desk.jpg', 'http://example.com/side.jpg'], contact: 'public@example.com',
    })
    await page.locator('form').evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(await page.evaluate(() => window.submissionCount), 1)
    await page.getByRole('button', { name: 'Fail test submission' }).click()
    await page.getByRole('alert').waitFor()
    assert.match(await page.getByRole('alert').textContent(), /please try again/)
    assert.equal(await page.locator('[name="contact"]').inputValue(), fields.contact)
    await page.getByRole('button', { name: 'Create listing', exact: true }).click()
    await page.getByRole('button', { name: 'Complete test submission' }).click()
    await page.getByRole('status').waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.submissionCount), 2)

    await page.getByRole('button', { name: 'Toggle external loading' }).click()
    await page.getByRole('status').waitFor()
    assert.equal(await page.locator('[name="title"]').isDisabled(), true)
    await page.getByRole('button', { name: 'Toggle external loading' }).click()
    await page.getByRole('button', { name: 'Set external error' }).click()
    assert.match(await page.getByRole('alert').textContent(), /Test server error/)
    assert.match(await page.locator('#listing-contact-help').textContent(), /visible to everyone/)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    assert.deepEqual(writes, [], 'The form must not make API writes')
    assert.deepEqual(pageErrors, [])
    console.log(`PASS ${viewport.width}px: collection, required/price/URL validation, callback, loading, errors, no overflow or API writes`)
    await page.close()
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
