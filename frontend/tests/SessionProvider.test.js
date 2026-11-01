import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { act, createElement, StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const originalFetch = globalThis.fetch
const originalConsoleError = console.error
const SIGNED_IN = { user: { id: 'fixture-user', displayName: 'Test Seller' }, csrfToken: 'test-only-token' }
let server
let dom
let root
let SessionProvider
let useSession
let currentSession
let requests

function SessionConsumer() {
  const session = useSession()
  useEffect(() => { currentSession = session }, [session])
  return createElement('p', null, session.user?.displayName ?? 'Public browsing')
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  SessionProvider = (await server.ssrLoadModule('/src/session/SessionProvider.tsx')).default
  useSession = (await server.ssrLoadModule('/src/session/useSession.ts')).useSession
})

beforeEach(() => {
  dom = new JSDOM('<div id="root"></div>')
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  root = createRoot(document.getElementById('root'))
  requests = []
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
  const provider = createElement(SessionProvider, null, createElement(SessionConsumer))
  await act(async () => {
    root.render(isStrict ? createElement(StrictMode, null, provider) : provider)
  })
}

async function respond(request, session) {
  await act(async () => request.resolve(Response.json(session)))
}

test('loading has no identity/token and does not block public children', async () => {
  await mount()
  assert.equal(currentSession.isLoading, true)
  assert.equal(currentSession.user, null)
  assert.equal(currentSession.csrfToken, null)
  assert.equal(currentSession.error, null)
  assert.equal(document.querySelector('p').textContent, 'Public browsing')
  assert.equal(requests[0].url, '/api/session')
})

test('null user becomes signed-out with a session CSRF token', async () => {
  await mount()
  await respond(requests[0], { user: null, csrfToken: 'fixture-token' })
  assert.equal(currentSession.user, null)
  assert.equal(currentSession.csrfToken, 'fixture-token')
  assert.equal(currentSession.isLoading, false)
  assert.equal(currentSession.error, null)
})

test('signed-in identity is shared and reset clears it without an HTTP mutation', async () => {
  await mount()
  await respond(requests[0], SIGNED_IN)
  assert.deepEqual(currentSession.user, SIGNED_IN.user)
  assert.equal(document.querySelector('p').textContent, 'Test Seller')
  await act(async () => currentSession.resetSession())
  assert.equal(currentSession.user, null)
  assert.equal(currentSession.csrfToken, null)
  assert.equal(currentSession.error, null)
  assert.equal(currentSession.isLoading, false)
  assert.equal(requests.length, 1)
})

test('HTTP and network failures clear identity, expose retry feedback, and log diagnostics', async () => {
  const errors = []
  console.error = (...details) => errors.push(details)
  await mount()
  await act(async () => requests[0].resolve(new Response('', { status: 503 })))
  assert.match(currentSession.error, /Unable to check/)
  assert.equal(currentSession.user, null)
  assert.equal(currentSession.isLoading, false)
  let refresh
  await act(async () => { refresh = currentSession.refreshSession() })
  await act(async () => { requests[1].reject(new Error('Offline')); await refresh })
  assert.equal(currentSession.csrfToken, null)
  assert.equal(errors.length, 2)
  assert.match(errors[0][1].message, /503/)
  await act(async () => { refresh = currentSession.refreshSession() })
  await act(async () => { requests[2].resolve(Response.json(SIGNED_IN)); await refresh })
  assert.deepEqual(currentSession.user, SIGNED_IN.user)
  assert.equal(currentSession.error, null)
})

test('refresh clears stale authenticated state while loading', async () => {
  await mount()
  await respond(requests[0], SIGNED_IN)
  let refresh
  await act(async () => { refresh = currentSession.refreshSession() })
  assert.equal(currentSession.user, null)
  assert.equal(currentSession.csrfToken, null)
  assert.equal(currentSession.isLoading, true)
  await act(async () => { requests[1].resolve(Response.json({ user: null, csrfToken: 'new-token' })); await refresh })
  assert.equal(currentSession.user, null)
  assert.equal(currentSession.isLoading, false)
})

test('reset aborts pending fetch and ignores a late authenticated response', async () => {
  await mount()
  await act(async () => currentSession.resetSession())
  assert.equal(requests[0].options.signal.aborted, true)
  await respond(requests[0], SIGNED_IN)
  assert.equal(currentSession.user, null)
  assert.equal(currentSession.csrfToken, null)
  assert.equal(currentSession.isLoading, false)
})

test('newer refresh wins even if an old request returns later', async () => {
  await mount()
  let refresh
  await act(async () => { refresh = currentSession.refreshSession() })
  assert.equal(requests[0].options.signal.aborted, true)
  await act(async () => { requests[1].resolve(Response.json(SIGNED_IN)); await refresh })
  await respond(requests[0], { user: null, csrfToken: 'stale' })
  assert.deepEqual(currentSession.user, SIGNED_IN.user)
})

test('StrictMode cleanup aborts the first request and unmount aborts the active request', async () => {
  await mount(true)
  assert.equal(requests.length, 2)
  assert.equal(requests[0].options.signal.aborted, true)
  await act(async () => root.unmount())
  assert.equal(requests[1].options.signal.aborted, true)
})
