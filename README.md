# EventSphere Management

A secure, real-time **expo & trade-show management platform** built with the **MERN** stack (MongoDB · Express · React · Node.js) using an **MVC** structure. It serves three audiences through dedicated portals:

| Portal | Who | Highlights |
|---|---|---|
| **Organizer** (`/admin`) | Event organizers | Expo CRUD, drag-and-drop floor plan & booth allocation, exhibitor application approval queue, schedule/session management with conflict detection, live analytics (traffic heatmap, session popularity, engagement), support tickets, user & feedback management, CSV reports |
| **Exhibitor** (`/exhibitor`) | Companies | Company profile (logo, catalog, documents), expo applications, **interactive booth selection & reservation**, booth showcase, staff management, visitor inquiries & appointments, B2B messaging with neighbouring exhibitors, support tickets |
| **Attendee** (`/attendee`) | Visitors | Event homepage with countdown, advanced exhibitor search & filters, interactive floor-plan viewer to locate booths, session bookmarking/registration with reminder alerts, inquiry & appointment booking, personal agenda (+ calendar export), light/dark mode |

Cross-cutting: role-based login/registration with portal selection, password reset, real-time updates (Socket.IO), notifications, feedback, GDPR tools (consent, data export, account erasure), WCAG-AA accessible UI, GSAP-powered animations.

## Quick start

```bash
# 1. API  (uses backend/.env — already configured with your MongoDB Atlas URI, standard non-SRV form)
cd backend
npm install
npm run seed          # demo data (one-time)
npm run dev           # → http://localhost:5000

# 2. Web app (new terminal)
cd frontend
npm install
npm run dev           # → http://localhost:5173
```

Open <http://localhost:5173>, pick a portal on the login screen and sign in:

| Portal | Email | Password |
|---|---|---|
| Organizer | `admin@eventsphere.com` | `Admin@123` |
| Exhibitor | `exhibitor@eventsphere.com` | `Exhibitor@123` |
| Exhibitor (no booth yet) | `exhibitor2@eventsphere.com` | `Exhibitor@123` |
| Attendee | `attendee@eventsphere.com` | `Attendee@123` |

Organizer self-registration requires the access code in `backend/.env` (`ORGANIZER_INVITE_CODE`).

Run the automated tests: `cd backend && npm test` (20 integration tests, in-memory MongoDB).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router 7, TanStack Query, Tailwind CSS v4, **GSAP** (+ ScrollTrigger), Socket.IO client, Lucide icons, Sonner toasts |
| Backend | Node.js, Express 4, Mongoose 9, Socket.IO, Zod, JWT, bcryptjs, Helmet, express-rate-limit, Multer, Cloudinary, Nodemailer |
| Database | MongoDB Atlas (`EventSphere_management`) |
| Quality | Node test runner + supertest + mongodb-memory-server |

## Documentation

| Document | Contents |
|---|---|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Step-by-step guide for organizers, exhibitors and attendees, with workflow diagrams and FAQ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagrams, request/auth/real-time flows, MVC mapping, **full folder structure** |
| [docs/API.md](docs/API.md) | Every REST endpoint, roles, payloads, Socket.IO events |
| [docs/DATABASE.md](docs/DATABASE.md) | ER diagram, collections, indexes, integrity rules, backup/restore |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, controls, GDPR, production checklist |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Setup, environment variables, nginx/PM2, scaling, monitoring |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy, manual E2E script, security & accessibility checklists |
| [docs/UI_DESIGN_SYSTEM.md](docs/UI_DESIGN_SYSTEM.md) | Design tokens, components, wireframes, floor-plan layouts, Tailwind guidelines |
| [docs/REQUIREMENTS_TRACEABILITY.md](docs/REQUIREMENTS_TRACEABILITY.md) | Every requirement of the project brief → implementation → evidence |

## Repository layout

```
backend/   Express API (models · controllers · routes · middleware · services · sockets · seed · scripts · tests)
frontend/   React SPA (pages per role · design-system components · FloorPlan · charts · hooks)
docs/     Documentation set
```

(See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#7-folder-structure) for the annotated tree.)

## Submission checklist (eProject)

- [x] Complete source code (`backend/`, `frontend/`)
- [x] Project documentation incl. login credentials (this file, `docs/`)
- [x] Database backup (`backend/backups/` + `npm run backup` / `restore`)
- [ ] Video of the complete working application — record following the script in `docs/TESTING.md` §3
