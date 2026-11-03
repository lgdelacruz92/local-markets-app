export interface ListingCreationValues {
  title: string
  description: string
  price: number
  currency: string
  category: string
  locality: string
  imageUrls: string[]
  contact: string
}

export interface ListingFormValues {
  title: string
  description: string
  price: string
  currency: string
  category: string
  locality: string
  imageUrls: string
  contact: string
}

export type ListingFormErrors = Partial<Record<keyof ListingFormValues, string>>
export type ListingValidationResult =
  | { values: ListingCreationValues; errors: null }
  | { values: null; errors: ListingFormErrors }

const REQUIRED_TEXT_FIELDS = {
  title: 'Enter a title.',
  description: 'Enter a description.',
  category: 'Enter a category.',
  locality: 'Enter a locality.',
  contact: 'Enter a public contact method.',
} as const

function validatePrice(priceText: string): string | null {
  if (!priceText.trim()) return 'Enter a price.'
  const price = Number(priceText)
  if (!Number.isFinite(price) || price < 0) {
    return 'Enter a valid price of zero or more.'
  }
  return null
}

function isImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Trims text, normalizes currency, and parses one optional image URL per line. */
export function validateListingForm(fields: ListingFormValues): ListingValidationResult {
  const errors: ListingFormErrors = {}
  for (const field of Object.keys(REQUIRED_TEXT_FIELDS) as Array<keyof typeof REQUIRED_TEXT_FIELDS>) {
    if (!fields[field].trim()) errors[field] = REQUIRED_TEXT_FIELDS[field]
  }
  const priceError = validatePrice(fields.price)
  if (priceError) errors.price = priceError
  const currency = fields.currency.trim().toUpperCase()
  if (!currency) errors.currency = 'Enter a currency code.'
  else if (!/^[A-Z]{3}$/.test(currency)) errors.currency = 'Use a three-letter currency code, such as USD.'

  const imageUrls = fields.imageUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean)
  if (imageUrls.some((url) => !isImageUrl(url))) {
    errors.imageUrls = 'Enter a complete HTTP or HTTPS image URL on each line.'
  }
  if (Object.keys(errors).length > 0) return { values: null, errors }
  return {
    errors: null,
    values: {
      title: fields.title.trim(), description: fields.description.trim(),
      price: Number(fields.price), currency, category: fields.category.trim(),
      locality: fields.locality.trim(), imageUrls, contact: fields.contact.trim(),
    },
  }
}
