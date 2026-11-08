/** Clears the server session; callers must reset shared state only after 204. */
export async function logout(csrfToken: string): Promise<void> {
  if (!csrfToken) {
    throw new Error('Your sign-in security token is missing. Reload the page before trying again.')
  }

  let response: Response
  try {
    response = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': csrfToken },
    })
  } catch (error) {
    throw new Error('Logout could not be confirmed. Check your connection and try again.', { cause: error })
  }

  if (response.status === 204) return
  if (response.status === 403) {
    throw new Error('Logout was rejected by the security check. Reload the page before trying again.')
  }
  throw new Error(`Logout could not be confirmed (HTTP ${response.status}). Please try again.`)
}
