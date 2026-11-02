import './config/load-env.js';
import { App } from './App.js';
import { logger } from './utils/logger.js';

const app = new App();

const start = async () => {
  try {
    await app.initialize();
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';

    app.server.listen({ port, host }, () => {
      logger.info({ port, host }, 'Application started successfully');
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start application');
    process.exit(1);
  }
};

start();

process.on('SIGTERM', () => app.gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => app.gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught Exception');
  process.exit(1);
});