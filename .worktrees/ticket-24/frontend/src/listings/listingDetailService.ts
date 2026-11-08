import { isListing } from './listingsService.ts'
import type { Listing } from './types.ts'

/** Public read. A missing listing returns null; all other failures reject. */
export async function fetchListing(id: string, signal: AbortSignal): Promise<Listing | null> {
  const response = await fetch(`/api/listings/${encodeURIComponent(id)}`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Listing request failed (HTTP ${response.status}).`)
  const result: unknown = await response.json()
  if (typeof result !== 'object' || result === null || !('listing' in result) ||
      !isListing(result.listing) || result.listing.id !== id) {
    throw new Error('Listing response did not match the API contract or requested ID.')
  }
  return result.listing
}
