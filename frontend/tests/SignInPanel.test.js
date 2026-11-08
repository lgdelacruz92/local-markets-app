import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

let server
let dom
let root
let SignInPanel

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  SignInPanel = (await server.ssrLoadModule('/src/auth/SignInPanel.tsx')).default
})

beforeEach(() => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'https://app.example/?status=401&authenticated=true&provider=google',
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  root = createRoot(document.getElementById('root'))
})

afterEach(async () => {
  await act(async () => root.unmount())
  dom.window.close()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
})

after(async () => server.close())

async function mount(props = {}) {
  await act(async () => root.render(createElement(SignInPanel, props)))
}

function assertNavigationAvailable() {
  const links = [...document.querySelectorAll('.sign-in-provider')]
  assert.deepEqual(links.map((link) => link.getAttribute('href')), [
    '/api/auth/google/start', '/api/auth/facebook/start',
  ])
  assert.deepEqual(links.map((link) => link.textContent), [
    'Continue with Google', 'Continue with Facebook',
  ])
  for (const link of links) {
    assert.equal(link.target, '', 'Redirect stays in the same tab')
    assert.equal(link.getAttribute('aria-describedby'), 'sign-in-help')
  }
  const browseLink = document.querySelector('a[href="/"]')
  assert.equal(browseLink.textContent, 'Continue without signing in')
}

test('native provider links and public browsing are available without trusting URL parameters', async () => {
  await mount()
  assertNavigationAvailable()
  assert.equal(document.querySelector('[role="alert"]'), null)
  assert.match(document.getElementById('sign-in-help').textContent, /Back button/)
})

for (const [status, message] of [[503, /not configured/], [401, /rejected or cancelled/], [400, /invalid or has expired/]]) {
  test(`trusted ${status} status announces actionable feedback and preserves retry and browsing`, async () => {
    await mount({ failureStatus: status })
    assert.match(document.querySelector('[role="alert"]').textContent, message)
    assertNavigationAvailable()
    await mount({ failureStatus: null })
    assert.equal(document.querySelector('[role="alert"]'), null)
  })
}
