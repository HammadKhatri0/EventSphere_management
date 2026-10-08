import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

const options = {
  maxPoolSize: 50,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  retryWrites: true,
};

/**
 * Connects to MongoDB. Some local resolvers (common on Windows / corporate networks) refuse the
 * SRV lookups that `mongodb+srv://` URIs need; in that case we retry once with public DNS servers.
 */
export async function connectDB(uri = env.mongoUri) {
  try {
    await mongoose.connect(uri, options);
  } catch (err) {
    const dnsIssue = /querySrv|ENOTFOUND|ECONNREFUSED|ETIMEOUT/i.test(err.message) && uri.startsWith('mongodb+srv');
    if (!dnsIssue) throw err;
    logger.warn('SRV lookup failed with the system resolver; retrying with public DNS servers');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    await mongoose.connect(uri, options);
  }
  logger.info(`MongoDB connected (${mongoose.connection.name})`);
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  return mongoose.connection;
}

export const disconnectDB = () => mongoose.disconnect();
