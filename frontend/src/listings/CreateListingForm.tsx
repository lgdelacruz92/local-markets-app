import { useState } from 'react'
import type { FormEvent } from 'react'
import ListingFormField from './ListingFormField.tsx'
import { validateListingForm } from './listingFormValidation.ts'
import type { ListingCreationValues, ListingFormErrors, ListingFormValues } from './listingFormValidation.ts'
import './CreateListingForm.css'

export interface CreateListingFormProps {
  onSubmit: (values: ListingCreationValues) => void | Promise<void>
  isSubmitting?: boolean
  submissionError?: string | null
}

function collectFields(form: HTMLFormElement): ListingFormValues {
  const data = new FormData(form)
  return {
    title: String(data.get('title') ?? ''),
    description: String(data.get('description') ?? ''),
    price: String(data.get('price') ?? ''),
    currency: String(data.get('currency') ?? ''),
    category: String(data.get('category') ?? ''),
    locality: String(data.get('locality') ?? ''),
    imageUrls: String(data.get('imageUrls') ?? ''),
    contact: String(data.get('contact') ?? ''),
  }
}

/** Form only: the caller owns authentication, API submission, and success navigation. */
export default function CreateListingForm({
  onSubmit, isSubmitting = false, submissionError = null,
}: CreateListingFormProps) {
  const [errors, setErrors] = useState<ListingFormErrors>({})
  const [isCallbackPending, setIsCallbackPending] = useState(false)
  const [callbackError, setCallbackError] = useState<string | null>(null)
  const isBusy = isSubmitting || isCallbackPending
  const visibleSubmissionError = submissionError || callbackError
  const hasValidationErrors = Object.keys(errors).length > 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isBusy) return
    setCallbackError(null)
    const result = validateListingForm(collectFields(event.currentTarget))
    setErrors(result.errors ?? {})
    if (!result.values) return
    setIsCallbackPending(true)
    try {
      await onSubmit(result.values)
    } catch (error) {
      console.error('Listing submission callback failed', error)
      setCallbackError('Unable to submit your listing. Your entries are saved here; please try again.')
    } finally {
      setIsCallbackPending(false)
    }
  }

  return (
    <form className="create-listing-form" onSubmit={handleSubmit} noValidate aria-busy={isBusy} aria-labelledby="create-listing-heading">
      <header>
        <h2 id="create-listing-heading">Create a listing</h2>
        <p>Tell local buyers about your item. All fields are required unless marked optional.</p>
      </header>
      {hasValidationErrors && <p className="listing-message" role="alert">Please correct the marked fields before submitting.</p>}
      {visibleSubmissionError && <p className="listing-message" role="alert">{visibleSubmissionError}</p>}
      <fieldset disabled={isBusy}>
        <legend className="listing-visually-hidden">Listing details</legend>
        <ListingFormField name="title" label="Title" error={errors.title} />
        <ListingFormField name="description" label="Description" isMultiline error={errors.description} />
        <div className="listing-field-pair">
          <ListingFormField name="price" label="Price" inputMode="decimal" help="Use a number of zero or more, with a decimal point if needed." error={errors.price} />
          <ListingFormField name="currency" label="Currency" help="Three-letter code, for example USD, EUR or GBP." error={errors.currency} />
        </div>
        <div className="listing-field-pair">
          <ListingFormField name="category" label="Category" help="For example, furniture or electronics." error={errors.category} />
          <ListingFormField name="locality" label="Locality" help="Your town or neighborhood, not your private address." error={errors.locality} />
        </div>
        <ListingFormField name="imageUrls" label="Image URLs" isMultiline isRequired={false} help="One public HTTP or HTTPS image URL per line. No file uploads." error={errors.imageUrls} />
        <ListingFormField name="contact" label="Public seller contact" help="This will be visible to everyone. Only enter an email, phone number, or other contact you deliberately want to make public." error={errors.contact} />
        <button type="submit">{isBusy ? 'Submitting…' : 'Create listing'}</button>
      </fieldset>
      {isBusy && <p role="status">Submitting your listing. Please wait.</p>}
    </form>
  )
}
