# Architecture

## 1. Overview

EventSphere is a classic **MERN** application organised with an **MVC** structure:

| MVC | In this project |
|---|---|
| **Model** | Mongoose schemas in `backend/src/models/` (data + invariants + indexes) |
| **View** | The React single-page app in `frontend/` (three role portals) |
| **Controller** | Express controllers in `backend/src/controllers/`, wired by `routes/`, protected by `middleware/`, with reusable business logic in `services/` |

```mermaid
flowchart LR
  subgraph Browser["Browser (React 19 SPA)"]
    UI["Pages & components<br/>Tailwind + GSAP"]
    RQ["React Query cache"]
    AX["Axios client<br/>(access token in memory)"]
    WS["Socket.IO client"]
    UI --> RQ --> AX
    UI --> WS
  end

  subgraph API["Node.js + Express API (stateless, N instances)"]
    MW["Middleware<br/>helmet · cors · rate-limit · sanitize<br/>auth (JWT) · RBAC · zod validation"]
    RT["Routes"]
    CT["Controllers"]
    SV["Services<br/>tokens · notifications · reminders · email · realtime"]
    MD["Mongoose models"]
    SK["Socket.IO server<br/>rooms: expo:id · user:id · admins"]
    MW --> RT --> CT --> SV
    CT --> MD
    SV --> MD
    SV --> SK
  end

  DB[("MongoDB Atlas<br/>EventSphere_management")]
  FS[("Cloudinary<br/>(images & PDFs)")]
  MAIL["SMTP"]

  AX -- "HTTPS /api  (JSON)" --> MW
  WS -- "WebSocket" --> SK
  MD --> DB
  CT --> FS
  SV --> MAIL
```

## 2. Request lifecycle

```mermaid
sequenceDiagram
  participant C as React (Axios)
  participant M as Middleware chain
  participant K as Controller
  participant S as Service / Model
  participant D as MongoDB
  C->>M: POST /api/expos/:id/booths/:b/reserve  (Bearer JWT)
  M->>M: helmet · CORS · rate limit · body parse · sanitize
  M->>M: protect (verify JWT, load user) → authorize('exhibitor')
  M->>M: validate(params, body) with zod
  M->>K: reserveBooth(req, res)
  K->>S: check approved application, booth limit
  K->>D: findOneAndUpdate({status:'available'} → 'reserved')  (atomic)
  D-->>K: updated booth  (or null → 409)
  K->>S: emit booth:updated (Socket.IO), notify organizers
  K-->>C: 200 { success:true, data:{ booth } }
  Note over C,D: errors anywhere → central errorHandler → { success:false, message, errors[] }
```

## 3. Authentication & session flow

```mermaid
sequenceDiagram
  participant U as User
  participant SPA as React SPA
  participant API as API
  participant DB as MongoDB
  U->>SPA: choose portal (Organizer/Exhibitor/Attendee) + credentials
  SPA->>API: POST /auth/login {email, password, role}
  API->>DB: find user, bcrypt compare, lock-out counters
  API-->>SPA: {user, accessToken(15m)}  +  Set-Cookie es_refresh (httpOnly)
  SPA->>SPA: keep accessToken in memory → route to /admin | /exhibitor | /attendee
  Note over SPA,API: normal calls send Authorization: Bearer
  SPA->>API: request with expired token
  API-->>SPA: 401
  SPA->>API: POST /auth/refresh (cookie)  — single-flight
  API->>DB: rotate token (old one revoked, new one stored hashed)
  API-->>SPA: new accessToken → original request retried
  Note over API,DB: re-use of a rotated refresh token ⇒ whole family revoked
```

## 4. Domain workflow — from application to booth

```mermaid
stateDiagram-v2
  [*] --> Pending: Exhibitor applies to expo
  Pending --> Approved: Organizer approves
  Pending --> Rejected: Organizer rejects (reason)
  Pending --> Withdrawn: Exhibitor withdraws
  Rejected --> Pending: re-apply
  Approved --> BoothReserved: Exhibitor reserves booth (atomic)
  BoothReserved --> BoothConfirmed: Organizer confirms
  BoothReserved --> Approved: released (by either side)
  Approved --> BoothConfirmed: Organizer assigns directly
  BoothConfirmed --> [*]
```

```mermaid
stateDiagram-v2
  direction LR
  [*] --> available
  available --> reserved: exhibitor reserves
  reserved --> booked: organizer confirms
  reserved --> available: release
  booked --> available: organizer releases
  available --> blocked: organizer blocks
  blocked --> available: unblock
```

## 5. Real-time design

```mermaid
flowchart TB
  A["Organizer confirms booth"] --> C["booth.controller"]
  B["Exhibitor reserves booth"] --> C
  C --> E["realtime.emitToExpo(expoId,'booth:updated')"]
  E --> R(("room expo:ID"))
  R --> X1["Attendee floor plan"]
  R --> X2["Exhibitor booth selection"]
  R --> X3["Organizer floor plan"]
  C --> N["notify() → Notification doc"] --> U(("room user:ID")) --> T["toast + bell badge"]
  C --> AD(("room admins")) --> AN["analytics:tick → dashboards refetch"]
```

* Public rooms (`expo:<id>`) can be joined anonymously; private rooms need a valid token at connect time.
* The React hook `useLiveBooths` loads the plan over REST and then patches the React-Query cache from socket events — no polling.
* Reminders: a scheduler ticks every 30 s and atomically claims due reminders (`reminderSent:false → true`) before notifying, so multiple instances never double-send.

## 6. Key design decisions

| Decision | Reason |
|---|---|
| Access token in memory + httpOnly refresh cookie | XSS cannot steal long-lived credentials; CSRF is mitigated by `SameSite` + CORS allow-list |
| zod validation on every endpoint | One declarative whitelist: type safety, mass-assignment protection, consistent field errors the UI shows inline |
| Atomic conditional updates instead of read-then-write | Correctness under concurrency (booths, session seats, reminders) without distributed locks |
| React Query + socket cache patches | Fewer requests, instant UI, simple invalidation |
| Tailwind v4 semantic tokens | Light/dark theming and WCAG contrast managed in one file |
| SVG floor plan (no canvas / heavy lib) | Native accessibility (focusable, labelled elements), crisp zoom, tiny bundle |
| Custom lightweight charts | No chart-library weight; accessible HTML/SVG; GSAP-animated |
| Route-level code splitting + manual vendor chunks | Fast first paint; each portal loads only what it uses |
| Env validation at boot | Misconfiguration fails fast, never silently insecure |

## 7. Folder structure

```
EventSphere_management/
├── README.md                       ← start here
├── docs/                           ← documentation set (this folder)
│   ├── USER_GUIDE.md              ← step-by-step guide for every role
│   ├── ARCHITECTURE.md · API.md · DATABASE.md · SECURITY.md
│   ├── DEPLOYMENT.md · TESTING.md · UI_DESIGN_SYSTEM.md
│   └── REQUIREMENTS_TRACEABILITY.md
├── backend/                        ← Node.js + Express + Mongoose  (Model / Controller layers)
│   ├── .env  .env.example          ← configuration (mongo_uri, secrets…)
│   ├── package.json
│   ├── uploads/                    ← local-disk fallback when Cloudinary is not configured
│   ├── backups/                    ← JSON database backups
│   ├── tests/                      ← integration tests (auth, workflow)
│   └── src/
│       ├── server.js               ← bootstrap: DB, HTTP, sockets, scheduler, graceful shutdown
│       ├── app.js                  ← Express app: security middleware, routes, error handling
│       ├── config/                 ← env.js (validated), db.js, constants.js
│       ├── models/                 ← User, RefreshToken, Expo, Booth, ExhibitorProfile, Application,
│       │                             Session, SessionRegistration, ExpoRegistration, Visit, Notification,
│       │                             Inquiry, Ticket, Conversation, Message, Feedback
│       ├── controllers/            ← auth, expo, booth, application, exhibitor, session,
│       │                             inquiry, ticket, message, analytics, misc, upload
│       ├── routes/index.js         ← every endpoint + its middleware chain
│       ├── middleware/             ← auth (protect/authorize), validate, sanitize, rateLimiters,
│       │                             errorHandler, upload
│       ├── validators/             ← zod schemas (auth, expo/booth/session, exhibitor/…)
│       ├── services/               ← token, email, storage (Cloudinary), notification, reminder, realtime, access
│       ├── sockets/index.js        ← Socket.IO server (rooms, auth)
│       ├── utils/                  ← ApiError, asyncHandler, logger, helpers
│       ├── seed/seed.js            ← demo data
│       └── scripts/                ← backup.js, restore.js
└── frontend/                       ← React 19 + Vite + Tailwind v4 + GSAP  (View layer)
    ├── index.html  vite.config.js
    └── src/
        ├── main.jsx  App.jsx       ← providers + route table (role-guarded, lazy-loaded)
        ├── index.css               ← design tokens (light/dark), base styles
        ├── lib/                    ← api (axios + refresh), socket, motion (GSAP), utils
        ├── context/                ← AuthContext, ThemeContext
        ├── hooks/                  ← useReveal, useCountUp, useLiveBooths, useSocketEvent, useForm…
        ├── components/
        │   ├── ui/                 ← design-system primitives (+ Modal)
        │   ├── layout/             ← DashboardLayout, AttendeeLayout, Guards, header parts
        │   ├── charts/             ← LineChart, BarList, Donut
        │   └── FloorPlan.jsx       ← interactive SVG floor plan (admin/select/view/heatmap)
        └── pages/
            ├── Landing.jsx
            ├── auth/               ← Login, Register, Forgot/Reset password, role selector
            ├── admin/              ← Organizer portal: Dashboard, Expos, ExpoForm, FloorPlanManager,
            │                         Applications, Schedule, Analytics, Support, FeedbackAdmin, Users, shared.jsx
            ├── exhibitor/          ← Exhibitor portal: Dashboard, Profile, Staff, Expos, Applications, Booths,
            │                         Inquiries, Messages, Support + Thread, BoothParts, shared.js
            ├── attendee/           ← Attendee interface: Home, Expos, ExpoDetail, Exhibitors, ExhibitorDetail,
            │                         Schedule, FloorPlanViewer, Agenda, Inquiries + SessionCard, ExpoCard,
            │                         ExhibitorCard, BoothDetails, Countdown, RegisterButton, calendar.js
            └── shared/             ← Notifications, Account & privacy, Feedback, NotFound
```

## 8. Mapping to the eProject specification

| Spec area | Location |
|---|---|
| User Authentication | `auth.controller.js`, `token.service.js`, `pages/auth/*` |
| Admin/Organizer Dashboard | `expo`, `booth`, `application`, `session`, `analytics` controllers · `pages/admin/*` |
| Exhibitor Portal | `exhibitor`, `application`, `booth`, `message`, `ticket` controllers · `pages/exhibitor/*` |
| Attendee Interface | `expo`, `session`, `exhibitor`, `inquiry` controllers · `pages/attendee/*` |
| Real-time updates | `sockets/`, `services/realtime.js`, `hooks/useLiveBooths` |
| Feedback & support | `ticket`, `misc` (feedback) controllers · support & feedback pages |
| Non-functional | see `SECURITY.md`, `DEPLOYMENT.md`, `TESTING.md`, `REQUIREMENTS_TRACEABILITY.md` |
