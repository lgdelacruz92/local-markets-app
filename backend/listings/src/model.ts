import { z } from 'zod';

const text = z.string().trim().min(1);
export const listingSchema = z.object({
  id: text,
  title: text,
  description: text,
  price: z.number().finite().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  category: text,
  locality: text,
  imageUrls: z.array(z.string().url().refine((url) => /^https?:\/\//i.test(url))),
  seller: z.object({ id: text, displayName: text, contact: text }),
  status: z.enum(['available', 'sold']),
  createdAt: z.string().datetime({ offset: true }),
});
export type Listing = z.infer<typeof listingSchema>;
export const listingsSchema = z.array(listingSchema).superRefine((items, ctx) => {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate listing IDs' });
  }
});

export type ListingFilters = { q?: string; locality?: string; category?: string };
export const filtersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  locality: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
}).strict();
