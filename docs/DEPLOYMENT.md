# Installation, Configuration & Deployment

## 1. Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS or newer (developed on 24) |
| npm | 10+ |
| MongoDB | Atlas cluster (provided) or local MongoDB 6+ |
| Browser | Latest Chrome, Edge, Firefox or Safari |

## 2. Local development

```bash
# 1) API
cd backend
npm install
#   .env is already provided (see §3). Then load demo data once:
npm run seed
npm run dev          # http://localhost:5000  (auto-restarts on change)

# 2) Web app (second terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173  (proxies /api, /uploads, /socket.io to :5000)
```

Open **http://localhost:5173**. Demo accounts (created by the seed script):

| Portal | Email | Password |
|---|---|---|
| Organizer | `admin@eventsphere.com` | `Admin@123` |
| Exhibitor (has a confirmed booth) | `exhibitor@eventsphere.com` | `Exhibitor@123` |
| Exhibitor (approved, no booth yet – use to try booth reservation) | `exhibitor2@eventsphere.com` | `Exhibitor@123` |
| Attendee | `attendee@eventsphere.com` | `Attendee@123` |

On the login page choose the matching portal (Organizer / Exhibitor / Attendee) before signing in. In development the login page also has a *Fill demo credentials* shortcut.

> **MongoDB Atlas + restrictive DNS:** `backend/.env` uses Atlas's *standard* connection string (`mongodb://host1,host2,host3/...&replicaSet=...`), which needs no SRV DNS lookup and therefore works on networks/resolvers that refuse `mongodb+srv://` (error `querySrv ECONNREFUSED`). The original SRV URI is kept as a comment; if you switch back to it, the API automatically retries with public DNS (8.8.8.8 / 1.1.1.1). To build the standard string for another cluster: Atlas → *Connect* → *Drivers* → choose *Node.js 2.2.12 or earlier*, or resolve the hosts with `nslookup -type=SRV _mongodb._tcp.<cluster-host> 8.8.8.8` and the replica-set name with `nslookup -type=TXT <cluster-host> 8.8.8.8`. Your IP address must also be on the Atlas **Network Access** list.

## 3. Environment variables (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `mongo_uri` | ✔ | – | MongoDB connection string (database `EventSphere_management`). |
| `JWT_ACCESS_SECRET` | ✔ | – | ≥ 32 chars. Signs 15-minute access tokens. |
| `JWT_REFRESH_SECRET` | ✔ | – | ≥ 32 chars. HMAC key used to hash refresh and password-reset tokens at rest. |
| `PORT` | | `5000` | API port. |
| `NODE_ENV` | | `development` | `production` enables secure cookies, JSON logs, hides stack traces. |
| `CLIENT_URL` | | `http://localhost:5173` | Comma-separated list of allowed web origins (CORS + links in emails). |
| `ACCESS_TOKEN_TTL` | | `15m` | Access-token lifetime. |
| `REFRESH_TOKEN_DAYS` | | `7` | Refresh-session lifetime. |
| `ORGANIZER_INVITE_CODE` | | *(empty = organizer sign-up disabled)* | Secret needed to register as an organizer. |
| `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET` | | *(empty = local disk)* | **Cloudinary** credentials. When set, all uploads (logos, banners, avatars, documents) go to the `eventsphere/` folder of your Cloudinary account and the CDN URL is stored in MongoDB. |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | | – | Outgoing mail for password resets. Without SMTP the email is logged and (dev only) the link is returned to the UI. |

Frontend (`frontend/.env`, optional): `VITE_API_URL` (default `/api`), `VITE_ASSET_BASE` (origin for `/uploads` and websockets when the API is on another domain).

## 4. NPM scripts

| Where | Command | Purpose |
|---|---|---|
| backend | `npm run dev` / `npm start` | Run API (watch / production) |
| backend | `npm run seed [-- --force]` | Load demo data (`--force` wipes first) |
| backend | `npm test` | Integration tests (in-memory MongoDB, never touches Atlas) |
| backend | `npm run backup` / `npm run restore -- <folder>` | JSON backup & restore |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run build` | Production bundle in `frontend/dist` (code-split, hashed assets) |

## 5. Production deployment (single VM example)

```
Internet ──HTTPS──► nginx ──┬── /            → static files  (frontend/dist)
                            ├── /api         → Node API  (127.0.0.1:5000, run by PM2)
                            ├── /uploads     → Node API
                            └── /socket.io   → Node API  (WebSocket upgrade)
```

1. `cd frontend && npm ci && npm run build` → copy `dist/` to the server.
2. `cd backend && npm ci --omit=dev`, create `.env` with production values (see checklist in `SECURITY.md`).
3. Run with PM2: `pm2 start src/server.js --name eventsphere -i max` (cluster mode) then `pm2 save`.
4. nginx site (TLS via Let's Encrypt / your certificate):

```nginx
server {
  listen 443 ssl http2;
  server_name expo.example.com;
  root /var/www/eventsphere/dist;
  index index.html;

  location /api/      { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host;
                        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                        proxy_set_header X-Forwarded-Proto $scheme; client_max_body_size 6m; }
  location /uploads/  { proxy_pass http://127.0.0.1:5000; }
  location /socket.io/ { proxy_pass http://127.0.0.1:5000; proxy_http_version 1.1;
                         proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";
                         proxy_set_header Host $host; }
  location /assets/   { expires 1y; add_header Cache-Control "public, immutable"; try_files $uri =404; }
  location /          { try_files $uri /index.html; }      # SPA fallback
}
```

## 6. Scaling out (hundreds → thousands of concurrent users)

| Layer | How it scales |
|---|---|
| API | Stateless (JWT + DB-backed refresh tokens) → run N instances behind a load balancer (`pm2 -i max` or several VMs). |
| Real-time | Socket.IO rooms. For more than one API instance add the Redis adapter in `src/sockets/index.js` (`@socket.io/redis-adapter`) or enable sticky sessions on the load balancer. |
| Background jobs | The reminder scheduler claims each reminder atomically, so every instance may run it without duplicates. |
| Database | Every query used by list/search pages is indexed; Atlas can scale vertically and horizontally (sharding by `expo` is natural for `booths`, `sessions`, `visits`). |
| Uploads | Stored on **Cloudinary** (CDN-delivered, no shared disk needed). Without Cloudinary credentials the API falls back to local disk (`backend/uploads`), which is single-server only. |
| Front end | Static, hashed, code-split bundles — serve from a CDN. |

## 7. Monitoring & operations

* **Health probe:** `GET /api/health` → `200 {status:"ok", db:"up"}` / `503` when the database is down.
* **Logs:** production writes one JSON object per line (ingest with any log shipper); HTTP access log via `morgan combined`.
* **Backups:** `npm run backup -- --keep=14` nightly + Atlas Cloud Backup. Test restores with `npm run restore`.
* **Maintenance windows:** deploy new versions with `pm2 reload eventsphere` (zero-downtime in cluster mode); announce planned downtime to users in advance (99% uptime target).
