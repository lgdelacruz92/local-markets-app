import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import SignInPanel from '../../src/auth/SignInPanel.tsx'
import '../../src/index.css'

// Trusted status injection exists only in tests; no URL-based production error handoff.
export default function SignInFixture() {
  const [failureStatus, setFailureStatus] = useState(null)

  return (
    <main>
      <SignInPanel failureStatus={failureStatus} />
      <aside aria-label="Test controls">
        <button onClick={() => setFailureStatus(503)}>Simulate unconfigured provider</button>
        <button onClick={() => setFailureStatus(401)}>Simulate rejected sign-in</button>
        <button onClick={() => setFailureStatus(400)}>Simulate invalid callback</button>
        <button onClick={() => setFailureStatus(null)}>Clear test failure</button>
      </aside>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<SignInFixture />)
