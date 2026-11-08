import { useEffect, useRef, useState } from 'react'
import { useSession } from '../session/useSession.ts'
import { markListingSold } from './markSoldService.ts'
import type { Listing } from './types.ts'

interface MarkSoldControlProps {
  listing: Listing
  updateListing: (listing: Listing) => void
  refreshListings: () => Promise<boolean>
}

export default function MarkSoldControl({ listing, updateListing, refreshListings }: MarkSoldControlProps) {
  const session = useSession()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const activeRequest = useRef<AbortController | null>(null)
  const isOwner = !session.isLoading && !session.error && session.user?.id === listing.seller.id

  useEffect(() => () => activeRequest.current?.abort(), [])

  async function handleMarkSold() {
    if (!isOwner || !session.csrfToken || activeRequest.current || listing.status === 'sold') return
    const controller = new AbortController()
    activeRequest.current = controller
    setIsPending(true)
    setError(null)
    setNotice(null)
    try {
      const soldListing = await markListingSold(listing.id, session.csrfToken, controller.signal)
      if (controller.signal.aborted) return
      updateListing(soldListing)
      setNotice('Item marked sold. Refreshing available listings…')
      const hasRefreshed = await refreshListings()
      if (controller.signal.aborted) return
      setNotice('Item marked sold.')
      if (!hasRefreshed) setError('Item is sold, but available listings could not be refreshed. Refresh the page to retry.')
    } catch (requestError) {
      if (controller.signal.aborted) return
      console.error('Unable to complete mark-sold request:', requestError)
      let message = 'Unable to confirm this item was marked sold. Refresh the listing and try again.'
      if (requestError instanceof Error && !(requestError instanceof TypeError) && !(requestError instanceof SyntaxError)) {
        message = requestError.message
      }
      setError(message)
    } finally {
      if (!controller.signal.aborted) setIsPending(false)
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }

  if (!isOwner) return null
  return (
    <div className="mark-sold-control" aria-busy={isPending}>
      {listing.status === 'available' && (
        <button type="button" onClick={() => void handleMarkSold()} disabled={isPending || !session.csrfToken}>
          {isPending ? 'Marking sold…' : 'Mark as sold'}
        </button>
      )}
      {isPending && !notice && <p role="status">Marking this item sold…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
