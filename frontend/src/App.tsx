import SignInPanel from './auth/SignInPanel.tsx'
import LogoutControl from './auth/LogoutControl.tsx'
import ListingsSection from './listings/ListingsSection.tsx'
import { useSession } from './session/useSession.ts'
import WelcomeSection from './WelcomeSection.tsx'

function App() {
  const { user, isLoading, error, refreshSession } = useSession()

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:rounded-xl focus:bg-white focus:p-4">Skip to content</a>
      <header className="flex flex-wrap items-center justify-between gap-4 py-6 sm:py-8">
        <a href="/" className="flex items-center gap-3 text-ink no-underline" aria-label="Local Markets home">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-peach">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <h1 className="text-2xl sm:text-3xl">Local Markets</h1>
        </a>
        <a href="#listings-heading" className="inline-flex min-h-11 items-center gap-2 font-bold no-underline hover:underline">Browse the neighborhood
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4"><path d="M6 18 18 6M6 6h12v12" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </header>
      <main id="main-content" tabIndex={-1} className="pb-12">
        <WelcomeSection />
        {isLoading && <p role="status" className="mt-6 rounded-2xl bg-white p-4 text-muted">Checking sign-in status…</p>}
        {error && (
          <div className="mt-6 rounded-2xl border border-error bg-peach p-5">
            <p role="alert" className="mb-3 text-error">{error}</p>
            <button type="button" onClick={refreshSession}>Retry sign-in check</button>
          </div>
        )}
        <LogoutControl />
        {!isLoading && !user && <SignInPanel />}
        <ListingsSection />
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-6 text-sm text-muted">
        <p className="font-bold text-ink">Local Markets</p>
        <p>A happier home for pre-loved things.</p>
      </footer>
    </div>
  )
}

export default App
