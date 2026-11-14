import { useRef, useState } from 'react'
import type { KeyboardEvent, TouchEvent } from 'react'

interface ListingPhotoGalleryProps {
  title: string
  imageUrls: string[]
}

export default function ListingPhotoGallery({ title, imageUrls }: ListingPhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const [loadedUrls, setLoadedUrls] = useState<string[]>([])
  const [failedThumbnailUrls, setFailedThumbnailUrls] = useState<string[]>([])
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const imageIndex = Math.min(selectedIndex, Math.max(0, imageUrls.length - 1))
  const imageUrl = imageUrls[imageIndex]
  const hasMultiplePhotos = imageUrls.length > 1
  const hasFailed = failedUrls.includes(imageUrl)
  const isLoaded = loadedUrls.includes(imageUrl)

  function showPhoto(offset: number) {
    if (!hasMultiplePhotos) return
    setSelectedIndex((imageIndex + offset + imageUrls.length) % imageUrls.length)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Thumbnail buttons keep their native keyboard behavior.
    if (event.target !== event.currentTarget || !hasMultiplePhotos) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      showPhoto(event.key === 'ArrowLeft' ? -1 : 1)
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStart.current = null
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStart.current
    touchStart.current = null
    if (!start || event.changedTouches.length !== 1) return
    const touch = event.changedTouches[0]
    const horizontalDistance = touch.clientX - start.x
    const verticalDistance = touch.clientY - start.y
    if (Math.abs(horizontalDistance) < 50 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return
    showPhoto(horizontalDistance < 0 ? 1 : -1)
  }

  function handleRetry() {
    setFailedUrls(failedUrls.filter((url) => url !== imageUrl))
    setLoadedUrls(loadedUrls.filter((url) => url !== imageUrl))
  }

  if (imageUrls.length === 0) {
    return <div className="listing-photo-placeholder">No photos provided</div>
  }

  return (
    <section className="listing-gallery" aria-label={`Photos of ${title}`} tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="listing-photo-stage" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchCancel={() => { touchStart.current = null }}>
        {!hasFailed && (
          <img
            key={imageUrl} className="listing-photo" src={imageUrl}
            alt={`${title} — photo ${imageIndex + 1} of ${imageUrls.length}`}
            loading="lazy" decoding="async" referrerPolicy="no-referrer"
            onLoad={() => setLoadedUrls((urls) => [...urls, imageUrl])}
            onError={() => setFailedUrls((urls) => [...urls, imageUrl])}
          />
        )}
        {!hasFailed && !isLoaded && <p className="listing-photo-message" role="status">Loading photo…</p>}
        {hasFailed && (
          <div className="listing-photo-message" role="status">
            <p>Photo unavailable. You can try again or browse other photos.</p>
            <button type="button" onClick={handleRetry}>Retry photo</button>
          </div>
        )}
      </div>
      <div className="listing-photo-controls">
        {hasMultiplePhotos && <button type="button" onClick={() => showPhoto(-1)} aria-label={`Previous photo of ${title}`}>‹</button>}
        <p aria-live="polite" aria-atomic="true">Photo {imageIndex + 1} of {imageUrls.length}</p>
        {hasMultiplePhotos && <button type="button" onClick={() => showPhoto(1)} aria-label={`Next photo of ${title}`}>›</button>}
      </div>
      {hasMultiplePhotos && (
        <div className="listing-photo-thumbnails" aria-label="Choose a photo">
          {imageUrls.map((url, index) => (
            <button
              key={`${index}-${url}`} type="button" aria-label={`Show photo ${index + 1} of ${title}`}
              aria-pressed={imageIndex === index} onClick={() => setSelectedIndex(index)}
            >
              {!failedThumbnailUrls.includes(url) && (
                <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedThumbnailUrls((urls) => [...urls, url])} />
              )}
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
      )}
      <a href={imageUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open full-size photo (new tab)</a>
    </section>
  )
}
