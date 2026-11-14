import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { act, createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import { LISTING } from './fixtures/listings.js'

const SIGNED_IN = { user: { id: 'fixture-user', displayName: 'Test Seller' }, csrfToken: 'test-only-token' }
const originalFetch = globalThis.fetch
const originalConsoleError = console.error
let server
let dom
let root
let App
let SessionProvider
let requests
let loggedErrors

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  App = (await server.ssrLoadModule('/src/App.tsx')).default
  SessionProvider = (await server.ssrLoadModule('/src/session/SessionProvider.tsx')).default
})

beforeEach(() => {
  dom = new JSDOM('<div id="root"></div>')
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  root = createRoot(document.getElementById('root'))
  requests = []
  loggedErrors = []
  console.error = (...details) => loggedErrors.push(details)
  globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
    requests.push({ url, options, resolve, reject })
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  dom.window.close()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
  globalThis.fetch = originalFetch
  console.error = originalConsoleError
})

after(async () => server.close())

async function mount(isStrict = false) {
  const application = createElement(SessionProvider, null, createElement(App))
  await act(async () => root.render(isStrict ? createElement(StrictMode, null, application) : application))
}

function activeRequest(url) {
  return requests.findLast((request) => request.url === url && !request.options.signal?.aborted)
}

async function respond(url, body) {
  await act(async () => activeRequest(url).resolve(Response.json(body)))
}

function buttonNamed(name) {
  return [...document.querySelectorAll('button')].find((button) => button.textContent === name)
}

test('successful login renders public listings instead of the placeholder or sign-in prompt', async () => {
  await mount()
  assert.match(document.body.textContent, /Loading listings/)
  await respond('/api/session', SIGNED_IN)
  await respond('/api/listings', { items: [LISTING] })
  assert.match(document.body.textContent, /Signed in as Test Seller/)
  assert.equal(document.querySelector('#sign-in-heading'), null)
  assert.equal(document.querySelector('article h3').textContent, LISTING.title)
  for (const text of ['USD 45.00', LISTING.description, LISTING.locality, LISTING.category, 'Alex', 'alex@example.com', 'available']) {
    assert.ok(document.querySelector('article').textContent.includes(text))
  }
  assert.doesNotMatch(document.body.textContent, /Hello world/)
  assert.equal(document.querySelector('[role="alert"]'), null)
})

test('listings do not wait for session loading or disappear when session lookup fails', async () => {
  await mount()
  await respond('/api/listings', { items: [LISTING] })
  assert.equal(document.querySelector('article h3').textContent, LISTING.title)
  assert.match(document.body.textContent, /Checking sign-in status/)
  await act(async () => activeRequest('/api/session').reject(new TypeError('Offline fixture')))
  assert.match(document.querySelector('[role="alert"]').textContent, /Browsing remains available/)
  assert.equal(document.querySelector('article h3').textContent, LISTING.title)
  assert.ok(buttonNamed('Retry sign-in check'))
  await act(async () => buttonNamed('Retry sign-in check').click())
  await respond('/api/session', SIGNED_IN)
  assert.match(document.body.textContent, /Signed in as Test Seller/)
  assert.equal(document.querySelector('article h3').textContent, LISTING.title)
})

test('signed-out visitors can browse and see sign-in links', async () => {
  await mount()
  await respond('/api/session', { user: null, csrfToken: 'test-only-token' })
  await respond('/api/listings', { items: [LISTING] })
  assert.ok(document.querySelector('#sign-in-heading'))
  assert.equal(document.querySelector('article h3').textContent, LISTING.title)
})

test('an empty collection shows an explicit empty state', async () => {
  await mount()
  await respond('/api/listings', { items: [] })
  assert.match(document.body.textContent, /No listings are available yet/)
  assert.equal(document.querySelector('article'), null)
})

for (const failure of ['HTTP', 'network', 'malformed']) {
  test(`${failure} listing failure shows safe feedback and retry restores listings`, async () => {
    await mount()
    await respond('/api/session', SIGNED_IN)
    await act(async () => {
      const request = activeRequest('/api/listings')
      if (failure === 'network') request.reject(new TypeError('Private fixture diagnostics'))
      else if (failure === 'HTTP') request.resolve(new Response('Private fixture diagnostics', { status: 500 }))
      else request.resolve(Response.json({ items: [{ title: 'Broken fixture' }] }))
    })
    assert.match(document.querySelector('[role="alert"]').textContent, /Unable to load listings/)
    assert.doesNotMatch(document.body.textContent, /Private fixture|Broken fixture/)
    assert.equal(loggedErrors.length, 1)
    await act(async () => buttonNamed('Try again').click())
    assert.equal(document.querySelector('[role="alert"]'), null)
    assert.match(document.body.textContent, /Loading listings/)
    await respond('/api/listings', { items: [LISTING] })
    assert.equal(document.querySelector('article h3').textContent, LISTING.title)
  })
}

test('successful logout retains public listings without another listing request', async () => {
  await mount()
  await respond('/api/session', SIGNED_IN)
  await respond('/api/listings', { items: [LISTING] })
  await act(async () => buttonNamed('Log out').click())
  await act(async () => activeRequest('/api/logout').resolve(new Response(null, { status: 204 })))
  assert.ok(document.querySelector('#sign-in-heading'))
  assert.equal(document.querySelector('article h3').textContent, LISTING.title)
  assert.equal(requests.filter((request) => request.url === '/api/listings').length, 1)
})

test('StrictMode cancels obsolete listing requests and ignores late results', async () => {
  await mount(true)
  const listingRequests = requests.filter((request) => request.url === '/api/listings')
  assert.equal(listingRequests.length, 2)
  assert.equal(listingRequests[0].options.signal.aborted, true)
  await respond('/api/listings', { items: [LISTING] })
  await act(async () => listingRequests[0].resolve(Response.json({ items: [] })))
  assert.equal(document.querySelector('article h3').textContent, LISTING.title)
  assert.equal(loggedErrors.length, 0)
})

test('unmount cancels a pending listings request and ignores its late failure', async () => {
  await mount()
  const request = activeRequest('/api/listings')
  await act(async () => root.unmount())
  assert.equal(request.options.signal.aborted, true)
  await act(async () => request.reject(new TypeError('Late offline fixture')))
  assert.equal(document.getElementById('root').textContent, '')
  assert.equal(loggedErrors.length, 0)
})
