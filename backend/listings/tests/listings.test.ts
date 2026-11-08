import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test, type TestContext } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { FileListingStore } from '../src/store.js';
import { listingSchema } from '../src/model.js';
import { seedListings } from '../src/seed.js';

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(process.cwd(), '.listings-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'listings.json');
  const store = await FileListingStore.open(file);
  return { file, store, app: createApp(store) };
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

test('browse is public, returns valid full listings and excludes sold items', async (t) => {
  const { app } = await fixture(t);
  const result = await request(app).get('/api/listings').expect(200);
  assert.deepEqual(ids(result.body.items), ['seed-chair', 'seed-bike', 'seed-monitor']);
  for (const item of result.body.items) assert.equal(listingSchema.safeParse(item).success, true);
  assert.equal(result.headers['set-cookie'], undefined);
});

test('q searches title and description with case-insensitive literal substrings', async (t) => {
  const { app } = await fixture(t);
  for (const q of ['OAK', 'blue CUSHION', '  reading  ']) {
    const result = await request(app).get('/api/listings').query({ q }).expect(200);
    assert.deepEqual(ids(result.body.items), ['seed-chair']);
  }
  const noRegex = await request(app).get('/api/listings').query({ q: '.*' }).expect(200);
  assert.deepEqual(noRegex.body.items, []);
});

test('locality substring, exact category and combined filters are case insensitive', async (t) => {
  const { app } = await fixture(t);
  const locality = await request(app).get('/api/listings').query({ locality: 'BROOK' }).expect(200);
  assert.deepEqual(ids(locality.body.items), ['seed-chair', 'seed-monitor']);
  const category = await request(app).get('/api/listings').query({ category: 'FURNITURE' }).expect(200);
  assert.deepEqual(ids(category.body.items), ['seed-chair']);
  const combined = await request(app).get('/api/listings').query({ q: 'display', locality: ' brookLYN ', category: ' Electronics ' }).expect(200);
  assert.deepEqual(ids(combined.body.items), ['seed-monitor']);
  for (const filters of [{ category: 'furn' }, { locality: 'Boston' }, { q: 'chair', locality: 'Queens' }]) {
    const empty = await request(app).get('/api/listings').query(filters).expect(200);
    assert.deepEqual(empty.body.items, []);
  }
});

test('empty filters behave as browse; unknown category returns an empty array', async (t) => {
  const { app } = await fixture(t);
  const result = await request(app).get('/api/listings?q=&locality=%20&category=').expect(200);
  assert.equal(result.body.items.length, 3);
  const unknown = await request(app).get('/api/listings?category=unknown').expect(200);
  assert.deepEqual(unknown.body, { items: [] });
});

test('details include all contract fields and sold listings remain readable', async (t) => {
  const { app } = await fixture(t);
  for (const listing of [seedListings[0], seedListings[3]]) {
    const result = await request(app).get(`/api/listings/${listing.id}`).expect(200);
    assert.deepEqual(result.body, { listing });
  }
});

test('absent IDs and unsupported routes return the shared JSON error envelope', async (t) => {
  const { app } = await fixture(t);
  const missing = await request(app).get('/api/listings/missing').expect(404);
  assert.deepEqual(missing.body, { error: { code: 'LISTING_NOT_FOUND', message: 'Listing not found.' } });
  assert.equal((await request(app).get('/api/unknown').expect(404)).body.error.code, 'NOT_FOUND');
  assert.equal((await request(app).post('/api/listings').send({}).expect(401)).body.error.code, 'UNAUTHENTICATED');
});

test('invalid duplicate, structured, unknown and excessive query inputs return 400', async (t) => {
  const { app } = await fixture(t);
  for (const query of ['q=one&q=two', 'locality=a&locality=b', 'category=a&category=b', 'q[x]=a', 'extra=x', `q=${'a'.repeat(201)}`, `category=${'a'.repeat(101)}`]) {
    const result = await request(app).get(`/api/listings?${query}`).expect(400);
    assert.equal(result.body.error.code, 'INVALID_QUERY');
  }
  const malformed = await request(app).get('/api/listings/%E0%A4%A').expect(400);
  assert.equal(malformed.body.error.code, 'INVALID_PATH');
});

test('seed initialization is idempotent, including concurrent opens', async (t) => {
  const { file } = await fixture(t);
  await rm(file);
  await Promise.all(Array.from({ length: 5 }, () => FileListingStore.open(file)));
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), seedListings);
  const before = await readFile(file, 'utf8');
  await FileListingStore.open(file);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('persisted edits and empty data survive reopen without reseeding; live reads see changes', async (t) => {
  const { file, app } = await fixture(t);
  const changed = { ...seedListings[0], id: 'persisted', price: 0, status: 'sold' as const };
  await writeFile(file, JSON.stringify([changed]));
  const reopened = await FileListingStore.open(file);
  assert.deepEqual(await reopened.findById('persisted'), changed);
  assert.deepEqual(await reopened.browse({}), []);
  assert.deepEqual((await request(app).get('/api/listings/persisted').expect(200)).body, { listing: changed });
  await writeFile(file, '[]');
  assert.deepEqual(await (await FileListingStore.open(file)).browse({}), []);
  assert.equal(await readFile(file, 'utf8'), '[]');
});

test('invalid existing data fails startup and is never replaced by seed', async (t) => {
  const { file } = await fixture(t);
  for (const invalid of ['broken-json', JSON.stringify([{ ...seedListings[0], price: -1 }]), JSON.stringify([seedListings[0], seedListings[0]])]) {
    await writeFile(file, invalid);
    await assert.rejects(FileListingStore.open(file));
    assert.equal(await readFile(file, 'utf8'), invalid);
  }
});

test('storage failures are safely handled and extra stored provider secrets are not exposed', async (t) => {
  const { file, app } = await fixture(t);
  await writeFile(file, JSON.stringify([{ ...seedListings[0], providerToken: 'secret', seller: { ...seedListings[0].seller, accessToken: 'secret' } }]));
  const result = await request(app).get('/api/listings').expect(200);
  assert.equal(JSON.stringify(result.body).includes('secret'), false);
  await writeFile(file, 'invalid');
  for (const url of ['/api/listings', '/api/listings/seed-chair']) {
    const failure = await request(app).get(url).expect(500);
    assert.deepEqual(failure.body, { error: { code: 'INTERNAL_ERROR', message: 'Unable to read listings.' } });
  }
  await rm(file);
  await request(app).get('/api/listings').expect(500);
});

async function startServer(file: string) {
  const child = spawn('node', ['--import', 'tsx', 'src/server.ts'], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', LISTINGS_DATA_FILE: file },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (data) => { stderr += data; });
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Server startup timeout: ${stderr}`)), 10000);
      let stdout = '';
      child.stdout.on('data', (data) => {
        stdout += data;
        const match = /listening on port (\d+)/.exec(stdout);
        if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
      });
      child.once('error', (error) => { clearTimeout(timeout); reject(error); });
      child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${stderr}`)); });
    });
    return { url, async stop() { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; } };
  } catch (error) { child.kill(); throw error; }
}

test('real server process restart preserves disk data and does not restore seed', async (t) => {
  const { file } = await fixture(t);
  const first = await startServer(file);
  try {
    await request(first.url).get('/api/listings').expect(200);
  } finally { await first.stop(); }
  const persisted = { ...seedListings[0], title: 'Survives process restart', price: 0 };
  await writeFile(file, JSON.stringify([persisted]));
  const second = await startServer(file);
  try {
    const result = await request(second.url).get('/api/listings').expect(200);
    assert.deepEqual(result.body, { items: [persisted] });
    assert.deepEqual((await request(second.url).get(`/api/listings/${persisted.id}`).expect(200)).body, { listing: persisted });
  } finally { await second.stop(); }
});
