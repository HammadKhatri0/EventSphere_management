# EventSphere REST API Reference

Base URL (development): `http://localhost:5000/api` · All bodies are JSON · All responses share one envelope:

```jsonc
{ "success": true,  "data": { ... } }                       // success
{ "success": false, "message": "Validation failed",         // error
  "errors": [ { "field": "email", "message": "Enter a valid email address" } ] }
```

Paginated lists return `data: { items: [...], pagination: { page, limit, total, pages } }` and accept `?page=&limit=` (limit ≤ 100).

## Authentication model

| Item | Detail |
|---|---|
| Access token | JWT (HS256), 15 min, sent as `Authorization: Bearer <token>`. Kept **in memory** by the SPA. |
| Refresh token | Opaque random 48-byte value, **httpOnly** `es_refresh` cookie (path `/api/auth`, `SameSite=Lax`, `Secure` in production). Stored hashed (HMAC-SHA256) server-side, rotated on every refresh. Re-use of a rotated token revokes the whole token family. |
| Roles | `admin` (shown as **Organizer** in the UI), `exhibitor`, `attendee`. |
| Legend below | 🌐 public · 🔑 any signed-in user · 🛡 organizer · 🏢 exhibitor · 🎟 attendee |

Common status codes: `400` validation · `401` not authenticated · `403` not allowed · `404` not found (also used to hide other users' records) · `409` conflict (duplicate, overlap, sold-out, already reviewed) · `423` account temporarily locked · `429` rate limited.

---

## System

| Method & path | Access | Description |
|---|---|---|
| `GET /health` | 🌐 | Liveness + DB state (`503` when MongoDB is down). Use for load balancer / uptime checks. |
| `GET /meta` | 🌐 | Categories, session types, reminder options, booth limit. |

## Auth — `/auth`

| Method & path | Access | Body / notes |
|---|---|---|
| `POST /auth/register` | 🌐 | `{ name, email, password, role, company?, phone?, organizerCode?, consent:true, marketingConsent? }`. Password ≥ 8 chars with upper, lower and digit. `role=admin` needs the invite code. Exhibitors need `company` and get an empty profile. Returns `{ user, accessToken }` and sets the refresh cookie. |
| `POST /auth/login` | 🌐 | `{ email, password, role? }`. If `role` is sent and differs from the account role → `403`. 5 failures lock the account for 15 min (`423`). |
| `POST /auth/refresh` | cookie | Rotates the refresh token, returns a new `accessToken` + `user`. |
| `POST /auth/logout` | 🌐 | Revokes the token family and clears the cookie. |
| `POST /auth/forgot-password` | 🌐 | `{ email }`. Always `200` (no account enumeration). In development without SMTP, response includes `devResetUrl`. |
| `POST /auth/reset-password` | 🌐 | `{ token, password }`. Token valid 30 min, single use; revokes all sessions. |
| `GET /auth/me` | 🔑 | Current user. |
| `PATCH /auth/me` | 🔑 | `{ name?, phone?, company?, avatar?, marketingConsent? }` |
| `PATCH /auth/me/password` | 🔑 | `{ currentPassword, newPassword }` – signs out other devices. |
| `GET /auth/me/export` | 🔑 | GDPR data export (JSON download). |
| `DELETE /auth/me` | 🔑 | `{ password }` – erases the account and personal data, releases held booths. |

## Uploads

| Method & path | Access | Notes |
|---|---|---|
| `POST /uploads/image` | 🔑 | multipart field `file` – PNG/JPEG/WebP/GIF ≤ 5 MB. Magic bytes are verified. |
| `POST /uploads/document` | 🔑 | PDF or image ≤ 5 MB. Returns `{ url: "/uploads/<file>", name, size }`. |

Files are stored on **Cloudinary** and `url` is the CDN delivery URL (`https://res.cloudinary.com/…`). Without Cloudinary credentials they are stored locally and served from `/uploads/*` (`url` = `/uploads/<file>`).

## Expos

| Method & path | Access | Notes |
|---|---|---|
| `GET /expos` | 🌐 | Filters: `q`, `status`, `upcoming=true`, `featured=true`, `mine=true` (organizer: own expos incl. drafts). Each item includes `stats { booths, available, reserved, booked, attendees }`. Public callers only see `published/ongoing/completed`. |
| `GET /expos/:id` | 🌐 | Drafts are visible only to the owner. Adds `registered` for attendees, `isOwner`. |
| `POST /expos` | 🛡 | `{ title, startDate, endDate, location{venue,address,city,country}, description?, theme?, categories?, status?, featured?, capacity?, floorPlan{cols,rows}?, banner? }` |
| `PATCH /expos/:id` | 🛡 owner | Partial update. Shrinking the floor plan below existing booths → `409`. Cancelling notifies registered attendees. |
| `DELETE /expos/:id` | 🛡 owner | Cascades booths, sessions, applications, registrations, visits, inquiries. |
| `POST /expos/:id/register` · `DELETE …/register` | 🎟 | Register for / cancel an expo (capacity checked). |
| `GET /expos/registrations/mine` | 🎟 | Expos I registered for. |

## Floor plan & booths

Booth status flow: `available → reserved (Pending Approval) → booked (Confirmed)`; organizer may also `blocked`.

| Method & path | Access | Notes |
|---|---|---|
| `GET /expos/:expoId/booths` | 🌐 | `{ floorPlan, booths[] }`. Company identity is exposed only for **booked** booths (owners/organizer also see reservations). Your own booths carry `mine: true`. |
| `POST /expos/:expoId/booths` | 🛡 owner | `{ code, x, y, w?, h?, size?, price?, zone? }` – validated for bounds and overlap. |
| `POST /expos/:expoId/booths/bulk` | 🛡 owner | Generate a grid: `{ rows, cols, startX, startY, w, h, gapX, gapY, prefix, size, price, zone }`. |
| `PATCH /expos/:expoId/booths/:boothId` | 🛡 owner | Move/resize/price/status (`available`↔`blocked` only). |
| `DELETE /expos/:expoId/booths/:boothId` | 🛡 owner | Not allowed while held by an exhibitor. |
| `POST …/booths/:boothId/reserve` | 🏢 | Requires an **approved** application; max 2 booths/expo. Atomic – exactly one caller wins a contested booth (`409` for the others). |
| `POST …/booths/:boothId/release` | 🏢 / 🛡 | Exhibitor: only own *reserved* booth. Organizer: any. |
| `POST …/booths/:boothId/confirm` | 🛡 owner | `reserved → booked`, notifies the exhibitor. |
| `POST …/booths/:boothId/assign` | 🛡 owner | `{ exhibitorId }` – directly books for an exhibitor with an approved application. |
| `PATCH …/booths/:boothId/showcase` | 🏢 holder | `{ tagline?, description?, products[]? }` |
| `POST …/booths/:boothId/visit` | 🌐 | Records a visit for the traffic heatmap (de-duplicated per user for 30 min). |
| `GET /expos/:expoId/approved-exhibitors` | 🛡 owner | Candidates for manual assignment. |
| `GET /booths/mine` | 🏢 | My booths across expos. |

## Exhibitors, applications

| Method & path | Access | Notes |
|---|---|---|
| `GET/PUT /exhibitors/profile/me` | 🏢 | Company profile: `companyName, tagline, description, logo, website, categories[], contact{}, products[], documents[], staff[]`. |
| `GET /exhibitors/dashboard` | 🏢 | Completeness %, applications, booths, ticket/inquiry counts, unread messages, booth visits. |
| `GET /exhibitors/directory` | 🌐 | Search exhibitors with a **confirmed** booth: `expo, q, category, product, sort, page, limit`. |
| `GET /exhibitors/:id` | 🌐 | Public profile (staff phone/email hidden) + booth locations. |
| `GET /exhibitors/neighbors?expo=&scope=` | 🏢 | Exhibitors whose booths are within 3 grid cells of yours (`scope=all` lists every exhibitor of the expo). |
| `POST /applications` | 🏢 | `{ expoId, productsServices?, message?, documents[]?, preferredBoothSize? }` – one active application per expo. |
| `GET /applications/mine` · `POST /applications/:id/withdraw` | 🏢 | |
| `GET /applications` | 🛡 | Queue for the organizer's expos: `status, expo, q, page` + `counts` by status. |
| `PATCH /applications/:id/review` | 🛡 | `{ status: "approved" \| "rejected", reason? }` – reason required for rejection; exhibitor is notified. |

## Schedule & sessions

| Method & path | Access | Notes |
|---|---|---|
| `GET /expos/:expoId/sessions` | 🌐 | Filters `q, type, topic, day`. Signed-in users get `my: { kind, reminderMinutes }` per session. |
| `POST /expos/:expoId/sessions` | 🛡 owner | `{ title, location, startTime, endTime, type?, topic?, description?, speakers[]?, capacity? }`. Room or speaker double-booking → `409`. |
| `PATCH /sessions/:id` · `DELETE /sessions/:id` | 🛡 owner | Time/room changes reset reminders and notify registrants. |
| `POST /sessions/:id/bookmark` | 🎟 | `{ reminderMinutes? }` |
| `POST /sessions/:id/register` | 🎟 | Atomic seat reservation (`409` when full); returns an overlap `warning` if clashing with another registration. |
| `POST /sessions/:id/unregister` | 🎟 | Downgrade to bookmark. |
| `DELETE /sessions/:id/mine` | 🎟 | Remove bookmark/registration. |
| `GET /sessions/mine` | 🎟 | My agenda. |

## Communication

| Method & path | Access | Notes |
|---|---|---|
| `GET /inquiries` | 🎟 / 🏢 | Attendee: sent. Exhibitor: received. |
| `POST /inquiries` | 🎟 | `{ expoId, exhibitorId, type: "inquiry"\|"appointment", subject, message, appointmentAt? }` |
| `GET /inquiries/:id` · `POST /inquiries/:id/messages` | participants | Thread + replies. |
| `PATCH /inquiries/:id/status` | 🏢 | `accepted \| declined \| completed` |
| `GET /tickets` · `POST /tickets` | 🏢 / 🛡 | Support tickets (exhibitor: own, organizer: all). |
| `GET /tickets/:id` · `POST /tickets/:id/messages` | owner / 🛡 | |
| `PATCH /tickets/:id` | 🛡 (🏢 close/reopen) | `{ status?, priority?, assignedTo? }` |
| `GET /messages/conversations` · `POST /messages/conversations` | 🏢 | B2B chat list / start `{ userId }` (must share an expo). |
| `GET /messages/conversations/:id` · `POST /messages/conversations/:id` | 🏢 | Read (marks read) / send `{ body }`. |
| `GET /notifications` · `POST /notifications/read-all` · `PATCH /notifications/:id/read` · `DELETE /notifications/:id` | 🔑 | Includes `unreadCount`. |
| `POST /feedback` | 🔑 | `{ type, message, rating? }` |
| `GET /feedback` · `PATCH /feedback/:id` | 🛡 | Review queue. |

## Users & analytics (organizer)

| Method & path | Notes |
|---|---|
| `GET /users` | `q, role, active, page` + `counts` by role. |
| `PATCH /users/:id` | `{ isActive?, role? }` (cannot change yourself). Deactivating revokes sessions. |
| `GET /analytics/overview` | Cross-expo KPIs. |
| `GET /analytics/expos/:id` | Totals, booth status, application funnel, registrations/day, engagement/day, booth traffic + heat data, session popularity, exhibitor categories. |
| `GET /analytics/expos/:id/report.csv` | CSV report (formula-injection safe). |

## Real-time events (Socket.IO)

Connect to the API origin (`path: /socket.io`) with `auth: { token: <accessToken> }` (optional for public rooms).

| Direction | Event | Payload |
|---|---|---|
| client → server | `expo:join` / `expo:leave` | `expoId` |
| server → `expo:<id>` room | `booth:updated` | public booth object |
| | `booth:deleted`, `booths:reload` | `{ _id }` / `{ expoId }` |
| | `schedule:updated` | `{ expoId, sessionId, action }` |
| | `expo:updated` | `{ expoId, title, status }` |
| server → `user:<id>` | `notification:new`, `message:new`, `inquiry:updated`, `ticket:updated` | |
| server → `admins` | `analytics:tick`, `application:new`, `ticket:new` | |
