import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import CreateListingForm from '../../src/listings/CreateListingForm.tsx'
import '../../src/index.css'

// Test-only callback controls. This fixture is not a production Vite entry point.
export default function CreateListingFixture() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState(null)

  function handleSubmit(values) {
    window.submittedValues = values
    window.submissionCount = (window.submissionCount ?? 0) + 1
    return new Promise((resolve, reject) => {
      window.completeSubmission = resolve
      window.failSubmission = () => reject(new Error('Test-only submission failure'))
    })
  }

  return (
    <main style={{ padding: '1rem' }}>
      <CreateListingForm onSubmit={handleSubmit} isSubmitting={isSubmitting} submissionError={submissionError} />
      <aside aria-label="Test controls">
        <button onClick={() => window.completeSubmission?.()}>Complete test submission</button>
        <button onClick={() => window.failSubmission?.()}>Fail test submission</button>
        <button onClick={() => setIsSubmitting(!isSubmitting)}>Toggle external loading</button>
        <button onClick={() => setSubmissionError('Test server error: Please try again.')}>Set external error</button>
      </aside>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<CreateListingFixture />)
