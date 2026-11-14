import ListingCard from './ListingCard.tsx'
import { useListings } from './useListings.ts'

export default function ListingsSection() {
  const { listings, isLoading, error, loadListings } = useListings()

  return (
    <section className="listings-section mt-10 sm:mt-14" aria-labelledby="listings-heading" aria-busy={isLoading}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-sm font-extrabold tracking-widest text-muted uppercase">Around the neighborhood</p>
          <h2 id="listings-heading" className="scroll-mt-6 text-3xl sm:text-4xl">Local listings</h2>
          <p className="mt-2 text-muted">Pre-loved finds, ready for their next home.</p>
        </div>
        {!isLoading && !error && listings.length > 0 && (
          <p className="rounded-full bg-honey px-4 py-2 text-sm font-bold">{listings.length} {listings.length === 1 ? 'local find' : 'local finds'}</p>
        )}
      </div>
      {isLoading && <p role="status" className="rounded-2xl border border-line bg-white p-8">Loading listings…</p>}
      {!isLoading && error && (
        <div className="rounded-2xl border border-error bg-peach p-6">
          <p role="alert" className="mb-4 text-error">{error}</p>
          <button type="button" onClick={loadListings}>Try again</button>
        </div>
      )}
      {!isLoading && !error && listings.length === 0 && <p className="rounded-2xl border border-line bg-white p-8 text-muted">No listings are available yet. Check back soon.</p>}
      {!isLoading && !error && listings.length > 0 && (
        <ul className="listing-grid grid list-none gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => <li key={listing.id} className="min-w-0"><ListingCard listing={listing} /></li>)}
        </ul>
      )}
    </section>
  )
}
