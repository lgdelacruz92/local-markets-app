import type { Listing } from './types.ts'

function isListing(value: unknown): value is Listing {
  if (typeof value !== 'object' || value === null) return false
  const listing = value as Record<string, unknown>
  const textFields = ['id', 'title', 'description', 'currency', 'category', 'locality', 'createdAt']
  for (const field of textFields) {
    if (typeof listing[field] !== 'string') return false
  }
  if (typeof listing.price !== 'number' || !Number.isFinite(listing.price) || listing.price < 0) return false
  if (listing.status !== 'available' && listing.status !== 'sold') return false
  if (!Array.isArray(listing.imageUrls) || !listing.imageUrls.every(url => typeof url === 'string')) return false
  const seller = listing.seller
  return typeof seller === 'object' && seller !== null &&
    'id' in seller && typeof seller.id === 'string' &&
    'displayName' in seller && typeof seller.displayName === 'string' &&
    'contact' in seller && typeof seller.contact === 'string'
}

/** Public read: no login or CSRF token is required. Filtering belongs to a later ticket. */
export async function fetchListings(signal: AbortSignal): Promise<Listing[]> {
  const response = await fetch('/api/listings', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  })
  if (!response.ok) {
    throw new Error(`Listings request failed (HTTP ${response.status}).`)
  }
  const result: unknown = await response.json()
  if (typeof result !== 'object' || result === null || !('items' in result) ||
      !Array.isArray(result.items) || !result.items.every(isListing)) {
    throw new Error('Listings response did not match the API contract.')
  }
  // The public endpoint promises available listings; never show a sold item if it leaks through.
  return result.items.filter(listing => listing.status === 'available')
}
