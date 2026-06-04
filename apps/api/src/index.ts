import { app } from './app.js';
import { env } from './config/index.js';
import { logger } from './utils/logger.js';

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
