import type { Listing } from './types.ts'

interface ListingCardProps {
  listing: Listing
}

export default function ListingCard({ listing }: ListingCardProps) {
  return (
    <article className="listing-card">
      <h3>{listing.title}</h3>
      <p className="listing-price">{listing.currency} {listing.price.toFixed(2)}</p>
      <p>{listing.description}</p>
      <dl>
        <div><dt>Location</dt><dd>{listing.locality}</dd></div>
        <div><dt>Category</dt><dd>{listing.category}</dd></div>
        <div><dt>Status</dt><dd>{listing.status}</dd></div>
        <div><dt>Seller</dt><dd>{listing.seller.displayName}</dd></div>
        <div><dt>Public contact</dt><dd>{listing.seller.contact}</dd></div>
      </dl>
    </article>
  )
}
