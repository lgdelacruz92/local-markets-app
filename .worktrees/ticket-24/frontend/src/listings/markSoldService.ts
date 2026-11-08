import { isListing } from './listingsService.ts'
import type { Listing } from './types.ts'

/** Only a confirmed, matching sold response may update the detail view. */
export async function markListingSold(id: string, csrfToken: string, signal: AbortSignal): Promise<Listing> {
  if (!csrfToken) throw new Error('Your session is not ready. Refresh the page and try again.')
  const response = await fetch(`/api/listings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ status: 'sold' }),
    signal,
  })
  if (response.status !== 200) {
    const messages: Record<number, string> = {
      400: 'The sold request was rejected. Refresh the page and try again.',
      401: 'Your session has expired. Sign in again before marking this item sold.',
      403: 'You are not authorized to mark this item sold. Refresh your session and try again.',
      404: 'This listing no longer exists. Refresh the page to check its status.',
    }
    throw new Error(messages[response.status] || `Unable to mark this item sold (HTTP ${response.status}).`)
  }
  const result: unknown = await response.json()
  if (typeof result !== 'object' || result === null || !('listing' in result) ||
      !isListing(result.listing) || result.listing.id !== id || result.listing.status !== 'sold') {
    throw new Error('The sold response could not be confirmed. Refresh the listing before trying again.')
  }
  return result.listing
}
