import type { HTMLAttributes } from 'react'
import type { ListingFormValues } from './listingFormValidation.ts'

interface ListingFormFieldProps {
  name: keyof ListingFormValues
  label: string
  error?: string
  help?: string
  isMultiline?: boolean
  isRequired?: boolean
  defaultValue?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
}

export default function ListingFormField({
  name, label, error, help, isMultiline = false, isRequired = true,
  defaultValue, inputMode,
}: ListingFormFieldProps) {
  const inputId = `listing-${name}`
  const describedBy = [help && `${inputId}-help`, error && `${inputId}-error`].filter(Boolean).join(' ')
  const fieldProps = {
    id: inputId, name, required: isRequired, defaultValue,
    className: 'w-full min-h-11 rounded-xl border border-muted bg-cream px-3 py-3 text-ink aria-invalid:border-2 aria-invalid:border-error disabled:cursor-not-allowed',
    'aria-invalid': Boolean(error), 'aria-describedby': describedBy || undefined,
  }

  return (
    <div className="listing-field mb-5 min-w-0">
      <label htmlFor={inputId} className="mb-2 block font-bold">{label}{!isRequired && ' (optional)'}</label>
      {help && <p id={`${inputId}-help`} className="listing-help mb-2 text-sm leading-relaxed text-muted">{help}</p>}
      {isMultiline ? <textarea {...fieldProps} rows={4} /> : <input {...fieldProps} type="text" inputMode={inputMode} />}
      {error && <p id={`${inputId}-error`} className="listing-field-error mt-2 text-sm font-bold text-error wrap-anywhere">{error}</p>}
    </div>
  )
}
