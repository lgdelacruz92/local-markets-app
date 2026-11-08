import './signIn.css'

export type AuthenticationFailureStatus = 400 | 401 | 503

type SignInPanelProps = {
  failureStatus?: AuthenticationFailureStatus | null
}

const FAILURE_MESSAGES = {
  400: 'This sign-in attempt is invalid or has expired. Start again using one of the providers below.',
  401: 'Sign-in was rejected or cancelled. You can try again or continue without signing in.',
  503: 'This sign-in provider is not configured yet. Try the other provider or continue without signing in.',
}

// The API currently has no documented error handoff to the app. The caller must
// supply a trusted response status; do not infer authentication from URL parameters.
export default function SignInPanel({ failureStatus = null }: SignInPanelProps) {
  return (
    <section className="sign-in-panel" aria-labelledby="sign-in-heading">
      <h2 id="sign-in-heading">Sign in to Local Markets</h2>
      <p>Choose a provider to continue on its secure sign-in page.</p>
      {failureStatus !== null && (
        <p className="sign-in-error" role="alert">{FAILURE_MESSAGES[failureStatus]}</p>
      )}
      <div className="sign-in-actions">
        {/* Native navigation follows the 302 without a CORS fetch or a second start request. */}
        <a className="sign-in-provider" href="/api/auth/google/start" aria-describedby="sign-in-help">Continue with Google</a>
        <a className="sign-in-provider" href="/api/auth/facebook/start" aria-describedby="sign-in-help">Continue with Facebook</a>
      </div>
      <p>You do not need an account to browse public listings.</p>
      <a href="/">Continue without signing in</a>
      <p className="sign-in-help" id="sign-in-help">
        If the sign-in page shows an error, use your browser’s Back button to return here.
        A 503 means the provider is not configured; try the other provider.
        A 401 means sign-in was rejected or cancelled; you can try again.
        A 400 means the attempt is invalid or expired; start a new attempt.
        You can always continue without signing in.
      </p>
    </section>
  )
}
