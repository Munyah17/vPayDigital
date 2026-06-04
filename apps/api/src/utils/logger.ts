import pino from 'pino';
import { env } from '../config/index.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.IS_PRODUCTION
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      '*.password',
      '*.cvv',
      '*.card_number',
      '*.pan',
      '*.secret',
      '*.api_key',
    ],
    censor: '[REDACTED]',
  },
});
