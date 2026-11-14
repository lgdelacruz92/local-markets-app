import SignInPanel from './auth/SignInPanel.tsx'
import LogoutControl from './auth/LogoutControl.tsx'
import ListingsSection from './listings/ListingsSection.tsx'
import { useSession } from './session/useSession.ts'

function App() {
  const { user, isLoading, error, refreshSession } = useSession()

  return (
    <main>
      <h1>Local Markets</h1>
      <p>Browse items from sellers in your community.</p>
      {isLoading && <p role="status">Checking sign-in status…</p>}
      {error && (
        <div>
          <p role="alert">{error}</p>
          <button type="button" onClick={refreshSession}>Retry sign-in check</button>
        </div>
      )}
      <LogoutControl />
      {!isLoading && !user && <SignInPanel />}
      <ListingsSection />
    </main>
  )
}

export default App
