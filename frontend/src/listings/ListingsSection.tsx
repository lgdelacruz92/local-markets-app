import ListingCard from './ListingCard.tsx'
import { useListings } from './useListings.ts'
import './listings.css'

export default function ListingsSection() {
  const { listings, isLoading, error, loadListings } = useListings()

  return (
    <section className="listings-section" aria-labelledby="listings-heading" aria-busy={isLoading}>
      <h2 id="listings-heading">Local listings</h2>
      {isLoading && <p role="status">Loading listings…</p>}
      {!isLoading && error && (
        <div>
          <p role="alert">{error}</p>
          <button type="button" onClick={loadListings}>Try again</button>
        </div>
      )}
      {!isLoading && !error && listings.length === 0 && <p>No listings are available yet. Check back soon.</p>}
      {!isLoading && !error && listings.length > 0 && (
        <ul className="listing-grid">
          {listings.map((listing) => <li key={listing.id}><ListingCard listing={listing} /></li>)}
        </ul>
      )}
    </section>
  )
}
