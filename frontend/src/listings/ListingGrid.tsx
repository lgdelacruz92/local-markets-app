import ListingCard from './ListingCard.tsx'
import type { ListingsState, OpenListing } from './types.ts'

interface ListingGridProps extends ListingsState {
  onRetry: () => void
  onOpenListing?: OpenListing
}

export default function ListingGrid({ items, isLoading, error, onRetry, onOpenListing }: ListingGridProps) {
  if (isLoading) {
    return <div className="browse-state" role="status">Loading available listings…</div>
  }
  if (error) {
    return (
      <div className="browse-state">
        <p role="alert">{error}</p>
        <button type="button" onClick={onRetry}>Try again</button>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="browse-state" role="status">
        <h3>No listings yet</h3>
        <p>Check back soon for items available in your community.</p>
      </div>
    )
  }
  return (
    <ul className="listing-grid" aria-label="Available listings">
      {items.map(listing => <ListingCard key={listing.id} listing={listing} onOpenListing={onOpenListing} />)}
    </ul>
  )
}
