import type { Listing } from './types.ts'

function isListing(value: unknown): value is Listing {
  if (typeof value !== 'object' || value === null) return false
  if (!('id' in value) || typeof value.id !== 'string' || !value.id.trim()) return false
  if (!('title' in value) || typeof value.title !== 'string') return false
  if (!('description' in value) || typeof value.description !== 'string') return false
  if (!('currency' in value) || typeof value.currency !== 'string') return false
  if (!('category' in value) || typeof value.category !== 'string') return false
  if (!('locality' in value) || typeof value.locality !== 'string') return false
  if (!('price' in value) || typeof value.price !== 'number') return false
  if (!Number.isFinite(value.price) || value.price < 0) return false
  if (!/^[A-Z]{3}$/.test(value.currency)) return false
  if (!('status' in value) || (value.status !== 'available' && value.status !== 'sold')) return false
  if (!('seller' in value) || typeof value.seller !== 'object' || value.seller === null) return false
  const seller = value.seller
  return 'displayName' in seller && typeof seller.displayName === 'string' &&
    'contact' in seller && typeof seller.contact === 'string'
}

/** Reads public listings independently of authentication; validates fields used by the UI. */
export async function fetchListings(signal: AbortSignal): Promise<Listing[]> {
  const response = await fetch('/api/listings', {
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error(`Listings request failed (HTTP ${response.status}).`)

  const result: unknown = await response.json()
  if (typeof result !== 'object' || result === null || !('items' in result) ||
      !Array.isArray(result.items) || !result.items.every(isListing)) {
    throw new Error('Listings response did not match the API contract.')
  }
  const identifiers = new Set(result.items.map((listing) => listing.id))
  if (identifiers.size !== result.items.length) throw new Error('Listings response contained duplicate IDs.')
  return result.items
}
