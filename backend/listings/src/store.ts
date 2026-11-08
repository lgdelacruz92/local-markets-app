import { randomUUID } from 'node:crypto';
import { mkdir, open, link, readFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { listingsSchema, type Listing, type ListingFilters } from './model.js';
import { seedListings } from './seed.js';

export interface ListingRepository {
  browse(filters: ListingFilters): Promise<Listing[]>;
  findById(id: string): Promise<Listing | undefined>;
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

export class FileListingStore implements ListingRepository {
  private constructor(public readonly filePath: string) {}

  static async open(filePath: string): Promise<FileListingStore> {
    const store = new FileListingStore(resolve(filePath));
    await mkdir(dirname(store.filePath), { recursive: true });
    try {
      await store.read();
    } catch (error) {
      if (!hasCode(error, 'ENOENT')) throw error;
      // Publish a complete seed atomically, without replacing an existing file.
      // Concurrent initializations cannot overwrite data created by another process.
      const temporary = `${store.filePath}.${randomUUID()}.tmp`;
      const handle = await open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(seedListings, null, 2)}\n`);
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await link(temporary, store.filePath);
      } catch (error) {
        if (!hasCode(error, 'EEXIST')) throw error;
      } finally {
        await unlink(temporary);
      }
      await store.read();
    }
    return store;
  }

  private async read(): Promise<Listing[]> {
    return listingsSchema.parse(JSON.parse(await readFile(this.filePath, 'utf8')));
  }

  async browse(filters: ListingFilters): Promise<Listing[]> {
    const q = filters.q?.toLowerCase() ?? '';
    const locality = filters.locality?.toLowerCase() ?? '';
    const category = filters.category?.toLowerCase() ?? '';
    return (await this.read()).filter((item) =>
      item.status === 'available' &&
      `${item.title}\n${item.description}`.toLowerCase().includes(q) &&
      item.locality.toLowerCase().includes(locality) &&
      (!category || item.category.toLowerCase() === category),
    );
  }

  async findById(id: string): Promise<Listing | undefined> {
    return (await this.read()).find((item) => item.id === id);
  }
}
