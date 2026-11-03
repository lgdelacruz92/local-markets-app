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
    'aria-invalid': Boolean(error), 'aria-describedby': describedBy || undefined,
  }

  return (
    <div className="listing-field">
      <label htmlFor={inputId}>{label}{!isRequired && ' (optional)'}</label>
      {help && <p id={`${inputId}-help`} className="listing-help">{help}</p>}
      {isMultiline ? <textarea {...fieldProps} rows={4} /> : <input {...fieldProps} type="text" inputMode={inputMode} />}
      {error && <p id={`${inputId}-error`} className="listing-field-error">{error}</p>}
    </div>
  )
}
