import ListingGrid from './ListingGrid.tsx'
import { useListings } from './useListings.ts'
import type { OpenListing } from './types.ts'
import './listings.css'

interface BrowsePageProps {
  onOpenListing?: OpenListing
}

export default function BrowsePage({ onOpenListing }: BrowsePageProps) {
  const { items, isLoading, error, refetch } = useListings()

  return (
    <main className="browse-page">
      <header className="browse-header">
        <p className="brand">Local Markets</p>
        <h1>Find your next great find.</h1>
        <p>Pre-loved items. New possibilities. Browse what’s available near you.</p>
      </header>
      <section aria-labelledby="listings-heading" aria-busy={isLoading}>
        <div className="browse-toolbar">
          <h2 id="listings-heading">Available listings</h2>
          <button type="button" onClick={() => void refetch()} disabled={isLoading}>
            Refresh listings
          </button>
        </div>
        <ListingGrid items={items} isLoading={isLoading} error={error}
          onRetry={() => void refetch()} onOpenListing={onOpenListing} />
      </section>
    </main>
  )
}
