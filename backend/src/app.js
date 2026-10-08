import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { UPLOAD_DIR } from './middleware/upload.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.isProd ? 1 : false); // correct client IPs behind a load balancer / reverse proxy

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // uploads are consumed by the SPA on another origin
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, // pure JSON API
  }));
  app.use(cors({
    origin: (origin, cb) => (!origin || env.clientOrigins.includes(origin) ? cb(null, true) : cb(new Error('Origin not allowed by CORS'))),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    maxAge: 86400,
  }));
  app.use(compression());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitizeInput);

  // Uploaded files: never executed or sniffed by the browser
  app.use('/uploads', express.static(UPLOAD_DIR, {
    maxAge: '7d', immutable: true, index: false, dotfiles: 'deny',
    setHeaders: (res, file) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (file.endsWith('.pdf')) res.setHeader('Content-Disposition', 'inline');
    },
  }));

  app.use('/api', apiLimiter, (req, res, next) => {
    // Never let intermediaries cache API responses carrying user data
    res.setHeader('Cache-Control', 'no-store');
    next();
  }, routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
