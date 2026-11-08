import { useState } from 'react'
import type { MouseEvent } from 'react'
import type { Listing, OpenListing } from './types.ts'

interface ListingCardProps {
  listing: Listing
  onOpenListing?: OpenListing
}

export default function ListingCard({ listing, onOpenListing }: ListingCardProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const imageUrl = listing.imageUrls[0]
  const hasImage = Boolean(imageUrl) && failedImageUrl !== imageUrl
  const price = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(listing.price)

  function handleOpen(event: MouseEvent<HTMLAnchorElement>) {
    if (!onOpenListing || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenListing(listing)
  }

  return (
    <li className="listing-card">
      <a className="listing-link" href={`/listings/${encodeURIComponent(listing.id)}`} onClick={handleOpen}>
        <div className="listing-photo">
          {hasImage ? (
            <img src={imageUrl} alt={listing.title} loading="lazy" onError={() => setFailedImageUrl(imageUrl)} />
          ) : (
            <span className="photo-placeholder">No photo available</span>
          )}
        </div>
        <div className="listing-info">
          <p className="listing-price">{price} <span>{listing.currency}</span></p>
          <h3>{listing.title}</h3>
          <p className="listing-locality">{listing.locality}</p>
        </div>
      </a>
    </li>
  )
}
