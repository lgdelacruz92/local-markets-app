// Contract fixtures are test-only; the production browse page always requests the API.
export const LISTING = {
  id: 'fixture-chair',
  title: 'Oak dining chair',
  description: 'A pre-loved wooden chair in good condition.',
  price: 35.5,
  currency: 'USD',
  category: 'Furniture',
  locality: 'Northside',
  imageUrls: ['https://images.example.test/chair.jpg'],
  seller: { id: 'fixture-seller', displayName: 'Test Seller', contact: 'test@example.test' },
  status: 'available',
  createdAt: '2026-11-01T12:00:00Z',
}

export const LISTINGS = [
  LISTING,
  { ...LISTING, id: 'fixture-book', title: 'Free gardening book', price: 0, currency: 'EUR', locality: 'Old Town', imageUrls: [] },
  { ...LISTING, id: 'fixture-bike', title: 'City bicycle', price: 125, currency: 'GBP', locality: 'West End', imageUrls: ['https://images.example.test/broken.jpg'] },
]
