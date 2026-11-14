export interface Listing {
  id: string
  title: string
  description: string
  price: number
  currency: string
  category: string
  locality: string
  imageUrls: string[]
  seller: { displayName: string; contact: string }
  status: 'available' | 'sold'
}
