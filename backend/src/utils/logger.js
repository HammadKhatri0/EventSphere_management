import { env } from '../config/env.js';

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = env.isTest ? -1 : env.isProd ? levels.info : levels.debug;

const write = (level, msg, meta) => {
  if (levels[level] > threshold) return;
  const line = { time: new Date().toISOString(), level, msg, ...(meta instanceof Error ? { err: meta.message, stack: env.isProd ? undefined : meta.stack } : meta) };
  // Structured JSON in production (log-aggregator friendly), readable lines in development.
  const out = env.isProd ? JSON.stringify(line) : `[${line.time}] ${level.toUpperCase()} ${msg}${meta ? ' ' + (meta instanceof Error ? meta.stack : JSON.stringify(meta)) : ''}`;
  (level === 'error' ? console.error : console.log)(out);
};

export const logger = {
  error: (m, x) => write('error', m, x),
  warn: (m, x) => write('warn', m, x),
  info: (m, x) => write('info', m, x),
  debug: (m, x) => write('debug', m, x),
};
