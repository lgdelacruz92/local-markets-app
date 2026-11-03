import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateListingForm } from '../src/listings/listingFormValidation.ts'

const validFields = {
  title: ' Desk ', description: ' Solid wood ', price: '12.50', currency: ' usd ',
  category: ' Furniture ', locality: ' Downtown ',
  imageUrls: ' https://example.com/desk.jpg \r\n\nhttp://example.com/side.jpg ', contact: ' public@example.com ',
}

test('collects all contracted values with numeric price and an image URL array', () => {
  assert.deepEqual(validateListingForm(validFields), {
    errors: null,
    values: {
      title: 'Desk', description: 'Solid wood', price: 12.5, currency: 'USD',
      category: 'Furniture', locality: 'Downtown',
      imageUrls: ['https://example.com/desk.jpg', 'http://example.com/side.jpg'], contact: 'public@example.com',
    },
  })
})

test('all required fields reject empty or whitespace-only input', () => {
  for (const field of ['title', 'description', 'price', 'currency', 'category', 'locality', 'contact']) {
    const result = validateListingForm({ ...validFields, [field]: '  ' })
    assert.equal(result.values, null)
    assert.ok(result.errors[field], `${field} needs an understandable error`)
  }
})

test('negative, nonnumeric and nonfinite prices are rejected; zero is accepted', () => {
  for (const price of ['-1', 'abc', 'NaN', 'Infinity', '1e999', '12,50']) {
    assert.match(validateListingForm({ ...validFields, price }).errors.price, /zero or more/)
  }
  assert.equal(validateListingForm({ ...validFields, price: '0' }).values.price, 0)
})

test('currency needs three letters and image URLs need HTTP(S)', () => {
  for (const currency of ['US', '123', 'USDD']) {
    assert.match(validateListingForm({ ...validFields, currency }).errors.currency, /three-letter/)
  }
  for (const imageUrls of ['not a URL', '/relative.jpg', 'javascript:alert(1)', 'ftp://example.com/image.jpg']) {
    assert.match(validateListingForm({ ...validFields, imageUrls }).errors.imageUrls, /HTTP or HTTPS/)
  }
  assert.deepEqual(validateListingForm({ ...validFields, imageUrls: ' \n ' }).values.imageUrls, [])
})
