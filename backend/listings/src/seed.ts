import { listingsSchema } from './model.js';

// Synthetic public contacts; no provider credentials or actual customer data.
export const seedListings = listingsSchema.parse([
  {
    id: 'seed-chair', title: 'Oak reading chair', description: 'Solid oak chair with a blue cushion. Lightly used.',
    price: 45, currency: 'USD', category: 'furniture', locality: 'Brooklyn, NY',
    imageUrls: ['https://images.unsplash.com/photo-1598300042247-d088f8ab3a91'],
    seller: { id: 'seed-alex', displayName: 'Alex', contact: 'alex@example.com' },
    status: 'available', createdAt: '2026-10-28T09:00:00.000Z',
  },
  {
    id: 'seed-bike', title: 'City bicycle', description: 'Seven-speed commuter bicycle, recently serviced.',
    price: 120, currency: 'USD', category: 'sports', locality: 'Queens, NY',
    imageUrls: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e'],
    seller: { id: 'seed-sam', displayName: 'Sam', contact: 'sam@example.com' },
    status: 'available', createdAt: '2026-10-28T10:00:00.000Z',
  },
  {
    id: 'seed-monitor', title: '24-inch monitor', description: 'Working display with HDMI cable included.',
    price: 65, currency: 'USD', category: 'electronics', locality: 'Brooklyn, NY',
    imageUrls: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf'],
    seller: { id: 'seed-alex', displayName: 'Alex', contact: 'alex@example.com' },
    status: 'available', createdAt: '2026-10-28T11:00:00.000Z',
  },
  {
    id: 'seed-table-sold', title: 'Coffee table', description: 'Small wooden coffee table.',
    price: 20, currency: 'USD', category: 'furniture', locality: 'Queens, NY',
    imageUrls: ['https://images.unsplash.com/photo-1533090161767-e6ffed986c88'],
    seller: { id: 'seed-sam', displayName: 'Sam', contact: 'sam@example.com' },
    status: 'sold', createdAt: '2026-10-28T12:00:00.000Z',
  },
]);
