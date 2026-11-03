import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const originalFormData = globalThis.FormData
const originalConsoleError = console.error
let server
let dom
let root
let CreateListingForm
let submitted

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  CreateListingForm = (await server.ssrLoadModule('/src/listings/CreateListingForm.tsx')).default
})

beforeEach(() => {
  dom = new JSDOM('<div id="root"></div>')
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.FormData = dom.window.FormData
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  root = createRoot(document.getElementById('root'))
  submitted = []
})

afterEach(async () => {
  await act(async () => root.unmount())
  dom.window.close()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.FormData = originalFormData
  console.error = originalConsoleError
})
after(async () => server.close())

async function mount(props = {}) {
  await act(async () => root.render(createElement(CreateListingForm, {
    onSubmit: (values) => { submitted.push(values) }, ...props,
  })))
}

function fillValidFields() {
  const fields = {
    title: ' Desk ', description: ' Wood desk ', price: '0', currency: 'eur',
    category: 'Furniture', locality: 'Town center', imageUrls: 'https://example.com/desk.jpg\nhttps://example.com/side.jpg',
    contact: 'seller@example.com',
  }
  for (const [name, value] of Object.entries(fields)) document.querySelector(`[name="${name}"]`).value = value
}

async function submit() {
  await act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
}

test('invalid required fields show associated errors and do not invoke the callback', async () => {
  await mount()
  await submit()
  assert.equal(submitted.length, 0)
  assert.equal(document.querySelectorAll('[aria-invalid="true"]').length, 7)
  assert.match(document.querySelector('[role="alert"]').textContent, /correct the marked fields/)
  const priceInput = document.querySelector('[name="price"]')
  assert.match(document.getElementById(priceInput.getAttribute('aria-describedby').split(' ').at(-1)).textContent, /Enter a price/)
})

test('valid form submits every field, normalized values, and an image URL array', async () => {
  await mount()
  fillValidFields()
  await submit()
  assert.deepEqual(submitted, [{
    title: 'Desk', description: 'Wood desk', price: 0, currency: 'EUR',
    category: 'Furniture', locality: 'Town center',
    imageUrls: ['https://example.com/desk.jpg', 'https://example.com/side.jpg'], contact: 'seller@example.com',
  }])
  assert.match(document.querySelector('#listing-contact-help').textContent, /visible to everyone/)
})

test('negative and nonnumeric price show a local error and retain entries', async () => {
  await mount()
  fillValidFields()
  for (const price of ['-1', 'not a number']) {
    document.querySelector('[name="price"]').value = price
    await submit()
    assert.match(document.querySelector('#listing-price-error').textContent, /zero or more/)
    assert.equal(submitted.length, 0)
    assert.equal(document.querySelector('[name="title"]').value, ' Desk ')
  }
})

test('external loading disables the form and external errors are visible', async () => {
  await mount({ isSubmitting: true, submissionError: 'Please sign in before submitting.' })
  assert.equal(document.querySelector('fieldset').disabled, true)
  assert.equal(document.querySelector('form').getAttribute('aria-busy'), 'true')
  assert.match(document.querySelector('[role="status"]').textContent, /Please wait/)
  assert.match(document.querySelector('[role="alert"]').textContent, /Please sign in/)
  await submit()
  assert.equal(submitted.length, 0)
})

test('pending callback prevents repeated submissions and failure can be retried', async () => {
  let rejectSubmission
  let calls = 0
  const loggedErrors = []
  console.error = (...details) => loggedErrors.push(details)
  await mount({ onSubmit: () => {
    calls += 1
    return new Promise((resolve, reject) => { rejectSubmission = reject })
  } })
  fillValidFields()
  await submit()
  assert.equal(document.querySelector('fieldset').disabled, true)
  await submit()
  assert.equal(calls, 1)
  await act(async () => rejectSubmission(new Error('Test-only failure')))
  assert.match(document.querySelector('[role="alert"]').textContent, /please try again/)
  assert.equal(document.querySelector('fieldset').disabled, false)
  assert.equal(loggedErrors.length, 1)
  assert.equal(document.querySelector('[name="contact"]').value, 'seller@example.com')
  await mount()
  await submit()
  assert.equal(submitted.length, 1)
  assert.equal(document.querySelector('[role="alert"]'), null)
})
