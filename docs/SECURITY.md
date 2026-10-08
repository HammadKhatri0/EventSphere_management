# Security & Privacy

This document maps the project's **security / privacy / reliability** requirements to concrete controls in the code.

## 1. Threat model summary

| Asset | Threats | Main controls |
|---|---|---|
| User credentials | brute force, credential stuffing, enumeration, DB leak | bcrypt (cost 12), lock-out, rate limits, uniform errors, hashed reset/refresh tokens |
| Sessions | XSS token theft, CSRF, token replay | in-memory access token (15 min), httpOnly+SameSite refresh cookie, rotation + reuse detection |
| Data integrity | NoSQL injection, mass assignment, double booking | input sanitiser, zod whitelist validation, atomic DB updates, unique indexes |
| Other users' data | IDOR / privilege escalation | RBAC middleware, ownership checks in every controller, 404 instead of 403 for foreign records |
| Platform availability | abuse / DoS, oversized payloads | rate limiting, 100 KB body cap, 5 MB upload cap, pagination caps |
| Personal data (GDPR) | over-collection, no erasure | explicit consent, data export, account erasure, data minimisation in public APIs |

## 2. Authentication

| Requirement | Implementation | Where |
|---|---|---|
| Secure registration/login, role differentiation | Role chosen at sign-up and **re-checked at login** (portal selector sends `role`). Organizer self-registration needs a secret invite code. | `auth.controller.js` |
| Password encryption | `bcryptjs`, 12 salt rounds; `select:false` so hashes never leave the DB layer; stripped in `toJSON` | `User.js` |
| Password policy | ≥ 8 chars, upper + lower + digit, ≤ 72 (bcrypt limit); same rules client-side with live checklist | `validators/common.js`, `Register.jsx` |
| Forgot / reset password | Random 32-byte token, **only its keyed hash (HMAC-SHA256) is stored**, 30-minute expiry, single use, all sessions revoked afterwards. Response never reveals whether the email exists. | `auth.controller.js` |
| Brute-force protection | 5 failures → 15-minute lock (`423`); `express-rate-limit` on auth routes (30 / 15 min / IP); constant-time dummy hash compare for unknown emails | `auth.controller.js`, `rateLimiters.js` |
| Session handling | 15-min JWT access token (HS256, algorithm pinned) + rotating refresh token in an httpOnly cookie. Reusing an old refresh token revokes the entire family. Password change invalidates earlier tokens (`passwordChangedAt`). Deactivated users are rejected on every request. | `token.service.js`, `middleware/auth.js` |
| Client token storage | Access token only in JS memory (not `localStorage`); silent refresh on reload and on `401` (single-flight) | `frontend/src/lib/api.js` |

## 3. Authorization

* `protect` → verifies token and loads the **fresh** user from the DB (role changes and deactivation apply immediately).
* `authorize('admin' | 'exhibitor' | 'attendee')` guards every route group (see `routes/index.js`).
* **Ownership checks** beyond role: organizers can only manage expos they organize (`loadOwnedExpo`); exhibitors can only edit booths/applications/tickets they own; inquiry and B2B conversation participants are verified; unknown/foreign records return `404` so identifiers cannot be probed.
* Business-rule gates: an exhibitor can reserve a booth **only with an approved application**, max 2 booths per expo; B2B messaging only between exhibitors sharing an approved expo.
* Front-end route guards (`RequireRole`) are a UX convenience only – the server is the source of truth.

## 4. Input handling

| Control | Detail |
|---|---|
| Schema validation | Every body/query/param is parsed by a **zod** schema; unknown fields are stripped (prevents mass-assignment, e.g. you cannot post `role` or `status` fields that aren't allowed). |
| NoSQL injection | `sanitizeInput` removes `$`-prefixed / dotted keys recursively; zod `string()` types reject objects such as `{ "$gt": "" }`. Regex searches escape user text (`escapeRegex`) to avoid ReDoS/regex injection. |
| Output encoding | React escapes by default; no `dangerouslySetInnerHTML`; email HTML escapes names; CSV export neutralises formula injection (`=`, `+`, `-`, `@`). |
| File uploads | Whitelist (PNG/JPEG/WebP/GIF/PDF), 5 MB, held in memory, **magic-byte verification** before anything is stored, random file names, then sent to **Cloudinary** (or local disk when not configured). API secrets stay on the server. Stored URLs in profiles/expos must be our own `/uploads/<file>` or `https://res.cloudinary.com/<our-cloud>/…`, so arbitrary external URLs / `javascript:` links cannot be saved. |
| Payload limits | JSON/body ≤ 100 KB, uploads 1 file, pagination `limit` ≤ 100. |

## 5. Transport & HTTP hardening

* **Helmet** security headers (CSP `default-src 'none'` for the API, `X-Content-Type-Options`, `Referrer-Policy`, HSTS in production …), `x-powered-by` disabled.
* **CORS** allow-list from `CLIENT_URL` (credentials enabled only for those origins).
* `Cache-Control: no-store` on all API responses.
* Cookies: `Secure` in production, `HttpOnly`, `SameSite=Lax`, scoped to `/api/auth`.
* **Always deploy behind HTTPS** (TLS terminated at nginx / load balancer; `trust proxy` is enabled in production so IPs and secure cookies work). MongoDB Atlas connections are TLS-encrypted by default → data is encrypted in transit; Atlas encrypts data at rest.

## 6. Privacy (GDPR)

| Principle | Feature |
|---|---|
| Informed consent | Registration requires an explicit Terms/Privacy checkbox (`consentAt` stored); marketing opt-in is separate, optional and revocable in *Account & privacy*. |
| Right of access / portability | `GET /auth/me/export` → JSON download of all personal data. |
| Right to erasure | `DELETE /auth/me` (password confirmed) removes profile, registrations, notifications, feedback, applications, tokens and frees held booths. The last organizer cannot delete themselves. |
| Data minimisation | Public endpoints never expose emails/phones of users or staff; pending reservations hide the company name; notifications auto-expire after 90 days and visit events after 1 year (TTL indexes). |

## 7. Reliability & observability

| Concern | Implementation |
|---|---|
| Uptime | Stateless API (scale horizontally), `/api/health` for probes, graceful shutdown on SIGINT/SIGTERM, MongoDB driver auto-reconnect, DNS fallback for Atlas SRV lookups. |
| Data safety | Atomic updates for contested resources, unique indexes, `npm run backup / restore`, Atlas cloud backups recommended. |
| Logging | `morgan` access log + structured JSON application log in production; errors never leak stack traces in production responses. |
| Error handling | One central error handler normalises zod / Mongoose / JWT / Multer / duplicate-key errors into the standard envelope. |
| Fail-fast config | `env.js` validates all environment variables at start (secrets ≥ 32 chars). |

## 8. Automated security tests

`backend/tests/` (run `npm test`) verifies, against an in-memory MongoDB: weak-password rejection, organizer invite code, NoSQL-injection payload rejection, role-portal mismatch, refresh-token rotation and re-use rejection, account lock-out, single-use password reset (no enumeration), RBAC on organizer routes, cross-user ticket isolation, private data not leaking in the public floor plan, draft expo visibility, GDPR export/erase, atomic booth/session contention.

## 9. Production checklist

- [ ] Replace both JWT secrets with long random values (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
- [ ] Change the demo passwords or remove the seed users; set a strong `ORGANIZER_INVITE_CODE`.
- [ ] Rotate the MongoDB Atlas database password that was shared during development and restrict the Atlas IP access list.
- [ ] Set `NODE_ENV=production`, `CLIENT_URL=https://your-domain`, serve over HTTPS.
- [ ] Configure SMTP so password-reset emails are delivered.
- [ ] Enable Atlas Cloud Backup + alerting; schedule `npm run backup`.
- [ ] Run `npm audit` periodically and keep dependencies current; commission a periodic penetration test (per the non-functional requirements).
