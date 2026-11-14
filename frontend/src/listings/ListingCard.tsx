import type { Listing } from './types.ts'
import ListingPhotoGallery from './ListingPhotoGallery.tsx'
import { resolveDemoListingPhotos } from './demoListingPhotos.ts'

interface ListingCardProps {
  listing: Listing
}

export default function ListingCard({ listing }: ListingCardProps) {
  const imageUrls = resolveDemoListingPhotos(listing)
  const hasDemoPhoto = imageUrls.some((url, index) => url !== listing.imageUrls[index])

  return (
    <article className="listing-card">
      <ListingPhotoGallery key={JSON.stringify(imageUrls)} title={listing.title} imageUrls={imageUrls} />
      {hasDemoPhoto && <p>Illustrative demo photo. <a href="/demo-listings/credits.html">Photo credits</a></p>}
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
