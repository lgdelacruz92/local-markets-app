import express, { type ErrorRequestHandler } from 'express';
import { filtersSchema } from './model.js';
import type { ListingRepository } from './store.js';
import { requireSessionWrite } from './auth.js';

export function createApp(repository: ListingRepository, authServiceUrl = 'http://127.0.0.1:3001') {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use('/api/listings', requireSessionWrite(authServiceUrl));

  app.get('/api/listings', async (req, res) => {
    const filters = filtersSchema.safeParse(req.query);
    if (!filters.success) {
      res.status(400).json({ error: { code: 'INVALID_QUERY', message: 'Use single q, locality and category text parameters (max 200, 200 and 100 characters).' } });
      return;
    }
    res.json({ items: await repository.browse(filters.data) });
  });

  app.get('/api/listings/:id', async (req, res) => {
    const listing = await repository.findById(req.params.id);
    if (!listing) {
      res.status(404).json({ error: { code: 'LISTING_NOT_FOUND', message: 'Listing not found.' } });
      return;
    }
    res.json({ listing });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof URIError) {
      res.status(400).json({ error: { code: 'INVALID_PATH', message: 'Invalid URL encoding.' } });
      return;
    }
    // Never disclose filesystem paths, schema input, credentials or stack traces.
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to read listings.' } });
  };
  app.use(errorHandler);
  return app;
}
