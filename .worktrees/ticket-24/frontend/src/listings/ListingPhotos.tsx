import { useState } from 'react'

interface ListingPhotosProps {
  imageUrls: string[]
  title: string
}

export default function ListingPhotos({ imageUrls, title }: ListingPhotosProps) {
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const uniqueUrls = [...new Set(imageUrls)]

  return (
    <section className="detail-photos" aria-label="Listing photos">
      {uniqueUrls.length === 0 && <p className="detail-photo-placeholder">No photos available</p>}
      {uniqueUrls.map((url, index) => (
        <div className="detail-photo" key={url}>
          {failedUrls.includes(url) ? (
            <p className="detail-photo-placeholder">Photo unavailable</p>
          ) : (
            <img src={url} alt={`${title} — photo ${index + 1}`} loading="lazy"
              onError={() => setFailedUrls(previous => [...previous, url])} />
          )}
        </div>
      ))}
    </section>
  )
}
