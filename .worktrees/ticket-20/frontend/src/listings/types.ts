export interface Listing {
  id: string
  title: string
  description: string
  price: number
  currency: string
  category: string
  locality: string
  imageUrls: string[]
  seller: { id: string; displayName: string; contact: string }
  status: 'available' | 'sold'
  createdAt: string
}

export interface ListingsFilters {
  q?: string
  locality?: string
  category?: string
}

export interface ListingsState {
  items: Listing[]
  isLoading: boolean
  error: string | null
}

export type OpenListing = (listing: Listing) => void
