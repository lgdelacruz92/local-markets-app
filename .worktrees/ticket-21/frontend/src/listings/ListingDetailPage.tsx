import ListingPhotos from './ListingPhotos.tsx'
import { useListingDetail } from './useListingDetail.ts'
import './listingDetail.css'

interface ListingDetailPageProps {
  listingId: string
}

export default function ListingDetailPage({ listingId }: ListingDetailPageProps) {
  const { listing, isLoading, isMissing, error, refetch } = useListingDetail(listingId)
  const price = listing ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(listing.price) : ''

  return (
    <main className="listing-detail-page">
      <a href="/" className="detail-back">← Browse listings</a>
      <section aria-busy={isLoading}>
        {isLoading && <p role="status">Loading listing…</p>}
        {isMissing && (
          <div role="status">
            <h1>Listing not found</h1>
            <p>This listing may have been removed. Try browsing other items.</p>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        {!isLoading && (
          <button type="button" onClick={() => void refetch()}>
            {error || isMissing ? 'Try again' : 'Refresh listing'}
          </button>
        )}
        {listing && (
          <article className="detail-layout">
            <ListingPhotos key={listing.id} imageUrls={listing.imageUrls} title={listing.title} />
            <div className="detail-information">
              <h1>{listing.title}</h1>
              <p className="detail-price">{price} <span>{listing.currency}</span></p>
              <p className={`detail-status detail-status-${listing.status}`}>
                Status: {listing.status === 'sold' ? 'Sold' : 'Available'}
              </p>
              <h2>Description</h2>
              <p className="detail-description">{listing.description}</p>
              <dl>
                <dt>Category</dt><dd>{listing.category}</dd>
                <dt>Locality</dt><dd>{listing.locality}</dd>
                <dt>Seller</dt><dd>{listing.seller.displayName}</dd>
                <dt>Seller contact (public)</dt><dd>{listing.seller.contact}</dd>
              </dl>
            </div>
          </article>
        )}
      </section>
    </main>
  )
}
