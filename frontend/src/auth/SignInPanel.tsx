export type AuthenticationFailureStatus = 400 | 401 | 503

type SignInPanelProps = {
  failureStatus?: AuthenticationFailureStatus | null
}

const FAILURE_MESSAGES = {
  400: 'This sign-in attempt is invalid or has expired. Start again using one of the providers below.',
  401: 'Sign-in was rejected or cancelled. You can try again or continue without signing in.',
  503: 'This sign-in provider is not configured yet. Try the other provider or continue without signing in.',
}

// The caller must supply a trusted status; URL parameters are not authentication results.
export default function SignInPanel({ failureStatus = null }: SignInPanelProps) {
  return (
    <section className="sign-in-panel mt-6 rounded-3xl border border-line bg-white p-6 sm:p-8" aria-labelledby="sign-in-heading">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-2 text-sm font-extrabold text-muted">Make yourself at home</p>
          <h2 id="sign-in-heading" className="text-2xl">Sign in to Local Markets</h2>
          <p className="mt-2 text-muted">Choose a provider to continue on its secure sign-in page.</p>
        </div>
        <div className="sign-in-actions flex flex-col gap-3 sm:flex-row">
          {/* Native links follow the provider redirect without a duplicate start request. */}
          <a className="sign-in-provider flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-cream px-4 py-3 text-center font-bold no-underline hover:bg-sage" href="/api/auth/google/start" aria-describedby="sign-in-help">Continue with Google</a>
          <a className="sign-in-provider flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-cream px-4 py-3 text-center font-bold no-underline hover:bg-sage" href="/api/auth/facebook/start" aria-describedby="sign-in-help">Continue with Facebook</a>
        </div>
      </div>
      {failureStatus !== null && (
        <p className="sign-in-error mt-4 rounded-xl border border-error bg-peach p-4 text-error" role="alert">{FAILURE_MESSAGES[failureStatus]}</p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
        <p className="text-muted">You do not need an account to browse public listings.</p>
        <a href="/" className="font-bold">Continue without signing in</a>
      </div>
      <details className="mt-4 text-sm text-muted">
        <summary className="w-fit cursor-pointer rounded font-bold text-leaf">Need help signing in?</summary>
        <p className="sign-in-help mt-3 max-w-3xl leading-relaxed" id="sign-in-help">
          If the sign-in page shows an error, use your browser’s Back button to return here.
          A 503 means the provider is not configured; try the other provider.
          A 401 means sign-in was rejected or cancelled; you can try again.
          A 400 means the attempt is invalid or expired; start a new attempt.
          You can always continue without signing in.
        </p>
      </details>
    </section>
  )
}
