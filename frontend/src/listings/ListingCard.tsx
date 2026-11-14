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
    <article className="listing-card h-full rounded-3xl border border-line bg-white p-5 shadow-card wrap-anywhere">
      <ListingPhotoGallery key={JSON.stringify(imageUrls)} title={listing.title} imageUrls={imageUrls} />
      {hasDemoPhoto && <p className="mb-4 text-xs leading-relaxed text-muted">Illustrative demo photo. <a href="/demo-listings/credits.html">Photo credits</a></p>}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-2xl leading-snug">{listing.title}</h3>
        <p className="listing-price rounded-lg bg-honey px-3 py-1.5 text-lg font-extrabold">{listing.currency} {listing.price.toFixed(2)}</p>
      </div>
      <p className="leading-relaxed text-muted">{listing.description}</p>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
        <div><dt className="font-bold">Location</dt><dd className="mt-1 text-muted">{listing.locality}</dd></div>
        <div><dt className="font-bold">Category</dt><dd className="mt-1 text-muted">{listing.category}</dd></div>
        <div><dt className="font-bold">Status</dt><dd className="mt-1 w-fit rounded-full bg-sage px-2 py-0.5">{listing.status}</dd></div>
        <div><dt className="font-bold">Seller</dt><dd className="mt-1 text-muted">{listing.seller.displayName}</dd></div>
        <div className="col-span-2"><dt className="font-bold">Public contact</dt><dd className="mt-1 text-muted">{listing.seller.contact}</dd></div>
      </dl>
    </article>
  )
}
