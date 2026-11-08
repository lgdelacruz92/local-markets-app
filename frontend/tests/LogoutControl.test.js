import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const SIGNED_IN = { user: { id: 'fixture-user', displayName: 'Test Seller' }, csrfToken: 'test-only-token' }
const originalFetch = globalThis.fetch
const originalConsoleError = console.error
let server
let dom
let root
let SessionProvider
let LogoutControl
let useSession
let currentSession
let requests
let loggedErrors

function SessionObserver() {
  const session = useSession()
  useEffect(() => { currentSession = session }, [session])
  return createElement('p', { id: 'shared-identity' }, session.user?.displayName ?? 'Signed out')
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  SessionProvider = (await server.ssrLoadModule('/src/session/SessionProvider.tsx')).default
  LogoutControl = (await server.ssrLoadModule('/src/auth/LogoutControl.tsx')).default
  useSession = (await server.ssrLoadModule('/src/session/useSession.ts')).useSession
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
  // Deferred fetch fixtures expose pending state and let each test choose the response.
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

async function mount(session = SIGNED_IN) {
  await act(async () => root.render(createElement(SessionProvider, null,
    createElement(LogoutControl), createElement(SessionObserver))))
  assert.equal(document.querySelector('button'), null, 'No control during session loading')
  await act(async () => requests[0].resolve(Response.json(session)))
}

async function clickLogout() {
  await act(async () => document.querySelector('button').click())
}

test('signed-out users have no logout control', async () => {
  await mount({ user: null, csrfToken: 'test-only-token' })
  assert.equal(document.querySelector('button'), null)
  assert.equal(requests.length, 1)
})

test('pending prevents duplicates; 204 resets identity and token for all session consumers', async () => {
  await mount()
  await clickLogout()
  assert.equal(requests[1].url, '/api/logout')
  assert.deepEqual(requests[1].options, {
    method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': SIGNED_IN.csrfToken },
  })
  assert.equal(document.querySelector('button').disabled, true)
  assert.match(document.querySelector('[role="status"]').textContent, /Logging out/)
  assert.deepEqual(currentSession.user, SIGNED_IN.user)
  await clickLogout()
  assert.equal(requests.length, 2)
  await act(async () => requests[1].resolve(new Response(null, { status: 204 })))
  assert.equal(document.querySelector('button'), null)
  assert.equal(document.querySelector('#shared-identity').textContent, 'Signed out')
  assert.equal(currentSession.user, null)
  assert.equal(currentSession.csrfToken, null)
  assert.equal(document.querySelector('[role="alert"]'), null)
})

for (const failure of ['403', 'network', 'unexpected 200']) {
  test(`${failure} keeps shared identity/token, explains failure and allows retry`, async () => {
    await mount()
    await clickLogout()
    await act(async () => {
      if (failure === 'network') {
        requests[1].reject(new TypeError('Test-only offline fixture'))
      } else {
        const status = failure === '403' ? 403 : 200
        requests[1].resolve(Response.json({ error: { code: 'REJECTED', message: 'Rejected' } }, { status }))
      }
    })
    const expectedMessage = failure === '403' ? /security check/ : /could not be confirmed/
    assert.match(document.querySelector('[role="alert"]').textContent, expectedMessage)
    assert.equal(document.querySelector('[role="status"]'), null)
    assert.equal(document.querySelector('button').disabled, false)
    assert.deepEqual(currentSession.user, SIGNED_IN.user)
    assert.equal(currentSession.csrfToken, SIGNED_IN.csrfToken)
    assert.equal(document.querySelector('#shared-identity').textContent, 'Test Seller')
    assert.equal(loggedErrors.length, 1)
    await clickLogout()
    assert.equal(document.querySelector('[role="alert"]'), null)
    await act(async () => requests[2].resolve(new Response(null, { status: 204 })))
    assert.equal(currentSession.user, null)
    assert.equal(currentSession.csrfToken, null)
  })
}

test('missing token disables logout with actionable feedback and no mutation', async () => {
  await mount({ ...SIGNED_IN, csrfToken: '' })
  assert.equal(document.querySelector('button').disabled, true)
  assert.match(document.querySelector('[role="alert"]').textContent, /Reload the page/)
  await clickLogout()
  assert.equal(requests.length, 1)
  assert.deepEqual(currentSession.user, SIGNED_IN.user)
})
