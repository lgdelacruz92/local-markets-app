import { useRef, useState } from 'react'
import { useSession } from '../session/useSession.ts'
import { logout } from './logoutService.ts'

export default function LogoutControl() {
  const { user, csrfToken, resetSession } = useSession()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestPending = useRef(false)

  async function handleLogout() {
    if (requestPending.current || !user || !csrfToken) return
    requestPending.current = true
    setIsPending(true)
    setError(null)

    try {
      await logout(csrfToken)
      resetSession()
    } catch (requestError) {
      console.error('Unable to log out:', requestError)
      const message = requestError instanceof Error
        ? requestError.message
        : 'Logout could not be confirmed. Please try again.'
      setError(message)
    } finally {
      requestPending.current = false
      setIsPending(false)
    }
  }

  if (!user) return null

  return (
    <section aria-label="Signed-in account">
      <p>Signed in as {user.displayName}</p>
      <button type="button" onClick={handleLogout} disabled={isPending || !csrfToken}>
        {isPending ? 'Logging out…' : 'Log out'}
      </button>
      {isPending && <p role="status">Logging out. Please wait.</p>}
      {error && <p role="alert">{error}</p>}
      {!csrfToken && (
        <p role="alert">Your sign-in security token is missing. Reload the page before logging out.</p>
      )}
    </section>
  )
}
