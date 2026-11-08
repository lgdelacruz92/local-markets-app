import { resolve } from 'node:path';
import { createApp } from './app.js';
import { FileListingStore } from './store.js';

const port = Number(process.env.PORT ?? '3002');
const host = process.env.HOST ?? '0.0.0.0';
const filePath = process.env.LISTINGS_DATA_FILE ?? resolve('data/listings.json');

async function start() {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer from 0 to 65535.');
  }
  const store = await FileListingStore.open(filePath);
  const server = createApp(store, process.env.AUTH_SERVICE_URL ?? 'http://127.0.0.1:3001').listen(port, host, () => {
    const address = server.address();
    console.log(`Listings service listening on port ${typeof address === 'object' && address ? address.port : port}`);
  });
  server.on('error', (error) => {
    console.error(`Listings service could not listen: ${error.message}`);
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => server.close(() => { process.exitCode = 0; }));
  }
}

start().catch(() => {
  console.error('Listings startup failed. Check PORT, AUTH_SERVICE_URL (trusted HTTP(S) origin), LISTINGS_DATA_FILE, directory permissions and the stored Listing array. Existing data is never overwritten on validation failure.');
  process.exitCode = 1;
});
