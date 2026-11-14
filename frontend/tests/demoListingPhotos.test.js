import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { resolveDemoListingPhotos } from '../src/listings/demoListingPhotos.ts'

const DEMO_PHOTOS = [
  ['seed-chair', 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91', '/demo-listings/chair.jpg'],
  ['seed-bike', 'https://images.unsplash.com/photo-1485965120184-e220f721d03e', '/demo-listings/bicycle.jpg'],
  ['seed-monitor', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf', '/demo-listings/monitor.png'],
  ['seed-table-sold', 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88', '/demo-listings/table.jpg'],
]

test('each original demo image resolves to a bundled asset without changing persisted URLs', async () => {
  for (const [id, originalUrl, localUrl] of DEMO_PHOTOS) {
    const imageUrls = [originalUrl]
    assert.deepEqual(resolveDemoListingPhotos({ id, imageUrls }), [localUrl])
    assert.deepEqual(imageUrls, [originalUrl])
    const asset = await readFile(new URL(`../public${localUrl}`, import.meta.url))
    assert.ok(asset.length > 1000)
  }
})

test('seller listings, unknown Unsplash photos, and customized demo photos remain unchanged', () => {
  const originalUrl = DEMO_PHOTOS[0][1]
  assert.deepEqual(resolveDemoListingPhotos({ id: 'seller-chair', imageUrls: [originalUrl] }), [originalUrl])
  const customUrls = ['https://images.unsplash.com/photo-custom', 'https://seller.example/chair.jpg']
  assert.deepEqual(resolveDemoListingPhotos({ id: 'seed-chair', imageUrls: customUrls }), customUrls)
  assert.deepEqual(resolveDemoListingPhotos({ id: 'seed-chair', imageUrls: [] }), [])
})

test('mixed galleries preserve image ordering and replace only the known demo URL', () => {
  const [, originalUrl, localUrl] = DEMO_PHOTOS[0]
  const customUrl = 'https://seller.example/chair.jpg'
  assert.deepEqual(resolveDemoListingPhotos({ id: 'seed-chair', imageUrls: [customUrl, originalUrl] }), [customUrl, localUrl])
})
