import http from 'node:http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSockets } from './sockets/index.js';
import { startReminderScheduler } from './services/reminder.service.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDB();
  const app = createApp();
  const server = http.createServer(app);
  const io = initSockets(server);
  const stopReminders = startReminderScheduler();

  server.listen(env.PORT, () => logger.info(`EventSphere API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`));

  // Graceful shutdown: stop accepting work, finish in-flight requests, close the DB.
  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    logger.info(`${signal} received, shutting down`);
    stopReminders();
    io.close();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  ['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
  process.on('unhandledRejection', (err) => logger.error('Unhandled rejection', err));
  process.on('uncaughtException', (err) => { logger.error('Uncaught exception', err); shutdown('uncaughtException'); });
}

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
