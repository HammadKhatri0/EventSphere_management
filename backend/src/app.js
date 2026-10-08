import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

// The JSON API / uploads get a locked-down policy; the single-page app needs its own assets, Google Fonts,
// Cloudinary images and websockets.
const apiHelmet = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: null } },
});
const webHelmet = helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: null, // the host's HTTPS termination already guarantees TLS; keeps plain-HTTP local testing working
    },
  },
});

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.isProd ? 1 : false); // correct client IPs behind a load balancer / reverse proxy

  app.use((req, res, next) => (/^\/(api|uploads)(\/|$)/.test(req.path) ? apiHelmet : webHelmet)(req, res, next));
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

  // Single-service hosting: serve the built React app (frontend/dist) and fall back to index.html for client-side routes.
  if (fs.existsSync(path.join(WEB_DIR, 'index.html')) && !env.isTest) {
    app.use(express.static(WEB_DIR, {
      index: false,
      dotfiles: 'deny',
      setHeaders: (res, file) => {
        res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
      },
    }));
    app.get(/^\/(?!api(\/|$)|uploads(\/|$)|socket\.io(\/|$)).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(WEB_DIR, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
