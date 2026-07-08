import { app } from './app.js';
import { env } from './config/index.js';
import { logger } from './utils/logger.js';
import { initializeProviders } from './providers/registry.js';

async function startServer() {
  try {
    // Initialize IBAN providers before starting server
    await initializeProviders();
    logger.info('IBAN providers initialized successfully');
  } catch (err) {
    logger.warn(`Provider initialization warning: ${err instanceof Error ? err.message : String(err)}`);
    // Don't fail startup if providers aren't configured yet
  }

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'vPay API server started');
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received — graceful shutdown');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received — graceful shutdown');
    server.close(() => process.exit(0));
  });

  process.on('unhandledRejection', (err) => {
    logger.error({ err }, 'Unhandled rejection');
  });
}

startServer().catch(err => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});

