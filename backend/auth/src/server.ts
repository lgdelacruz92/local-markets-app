import { createAuthApp } from './app.js';
import { loadConfig } from './config.js';

try {
  const config = loadConfig();
  const port = Number(process.env.PORT ?? '3001');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535.');
  const server = createAuthApp(config).listen(port, process.env.HOST ?? '127.0.0.1', () => {
    console.log(`Auth service listening on port ${(server.address() as { port: number }).port}`);
  });
  server.on('error', () => { console.error('Auth service could not listen. Check HOST and PORT.'); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close(() => { process.exitCode = 0; }));
} catch (error) {
  // Configuration errors contain variable names, never credential values.
  console.error(`Auth startup failed: ${error instanceof Error ? error.message : 'Check auth environment configuration.'}`);
  process.exitCode = 1;
}
