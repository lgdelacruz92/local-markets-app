import type { Listing } from './types.ts'

const DEMO_PHOTOS: Record<string, { originalUrl: string; localUrl: string }> = {
  'seed-chair': {
    originalUrl: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91',
    localUrl: '/demo-listings/chair.jpg',
  },
  'seed-bike': {
    originalUrl: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e',
    localUrl: '/demo-listings/bicycle.jpg',
  },
  'seed-monitor': {
    originalUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf',
    localUrl: '/demo-listings/monitor.png',
  },
  'seed-table-sold': {
    originalUrl: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88',
    localUrl: '/demo-listings/table.jpg',
  },
}

/** Replaces only the original demo photos, including those in existing data volumes. */
export function resolveDemoListingPhotos(listing: Pick<Listing, 'id' | 'imageUrls'>): string[] {
  const demoPhoto = DEMO_PHOTOS[listing.id]
  if (!demoPhoto) return listing.imageUrls

  return listing.imageUrls.map((url) => {
    if (url === demoPhoto.originalUrl) return demoPhoto.localUrl
    return url
  })
}
