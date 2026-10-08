# Requirements Traceability Matrix

Every requirement of the eProject brief (`MERN-EventSphere_Management.docx`) and of the UI/UX brief, mapped to its implementation and verification. Paths are relative to the repository root. **T** = covered by an automated test in `backend/tests/`; **M** = verify with the manual script in `docs/TESTING.md`.

## A. Functional requirements

### User authentication
| Requirement | Implementation | Evidence |
|---|---|---|
| Registration & login for organizers, exhibitors, attendees | `backend/src/controllers/auth.controller.js`, `frontend/src/pages/auth/{Login,Register}.jsx`, role selector `RoleSelector.jsx` | T auth, M #2–3 |
| Differentiate roles at registration | `role` field validated by zod; organizer requires `ORGANIZER_INVITE_CODE`; exhibitor gets a company + profile | T |
| Portal routing after login | `ROLE_HOME` + `RequireRole` guards in `frontend/src/App.jsx` | M |
| Forgot / reset password | `forgotPassword` / `resetPassword`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `email.service.js` | T |
| Password encryption | bcrypt (12 rounds) in `User.js`; tokens HMAC-hashed | T |

### Admin / Organizer dashboard
| Requirement | Implementation |
|---|---|
| Create / edit / delete expos; title, date, location, description, theme | `expo.controller.js`, `pages/admin/Expos.jsx`, `ExpoForm.jsx` |
| Allocate booth spaces on the floor plan | `booth.controller.js` (create, bulk grid, move, price, block, assign) · `FloorPlanManager.jsx` + `FloorPlan.jsx` (drag & drop) |
| View exhibitor registrations & applications; approve / reject | `application.controller.js` · `pages/admin/Applications.jsx` (reason required for rejection) |
| Assign booth spaces & manage booth details | `confirmBooth`, `assignBooth`, `updateBooth`, showcase |
| Create & manage schedules, time slots, sessions | `session.controller.js` · `pages/admin/Schedule.jsx` |
| Assign speakers, topics, locations; allow changes | Session `speakers[]`, `topic`, `location`; updates notify registrants, conflicts detected (T) |
| Analytics & reporting: engagement, booth traffic, session popularity | `analytics.controller.js` · `Analytics.jsx`, `Dashboard.jsx`; CSV export; heatmap on floor plan |
| Real-time analytics | Socket events `analytics:tick`, throttled refetch; "Live" indicator |

### Exhibitor portal
| Requirement | Implementation |
|---|---|
| Register for expos with company details, products/services, documents | `apply` endpoint · `pages/exhibitor/Expos.jsx` (apply modal with documents) |
| Update profile: logo, description, contact info | `exhibitor.controller.js` (`upsertMyProfile`) · `Profile.jsx` |
| View available booths on floor plans | `GET /expos/:id/booths` · `Booths.jsx` (`FloorPlan mode="select"`) |
| Select & reserve booths by preference | Atomic `reserveBooth` (approved application required, max 2) (T race test) |
| Manage booth details: products showcased, staff | `updateShowcase`, `Staff.jsx`, `BoothParts.jsx` |
| Communicate with organizers for inquiries/support | `ticket.controller.js` · `Support.jsx` (organizer: `admin/Support.jsx`) |
| Interact with neighbouring exhibitors (messaging / contact exchange) | `exhibitor.controller.js#neighbors`, `message.controller.js` · `Messages.jsx` (real-time chat, contact details) |

### Attendee interface
| Requirement | Implementation |
|---|---|
| Event details, schedule, exhibitor list, floor plans | `Home.jsx`, `Expos.jsx`, `ExpoDetail.jsx` (tabs) |
| Register for events, sessions, workshops | `registerForExpo`, `session.register` (capacity-safe) |
| Search & filter exhibitors by category, product, keyword | `GET /exhibitors/directory` · `Exhibitors.jsx` |
| View profiles and booth locations on the floor plan | `ExhibitorDetail.jsx`, `FloorPlanViewer.jsx` (highlight/locate) |
| Initiate communication with exhibitors (chat/email, appointments) | `inquiry.controller.js` · inquiry/appointment form + `Inquiries.jsx` (threaded replies) |
| Browse schedules; bookmark or register for sessions | `Schedule.jsx`, `SessionCard.jsx`, `Agenda.jsx` |
| Notifications / reminders for bookmarked sessions | `reminder.service.js` (atomic, idempotent) + notification bell, toast, change alerts (T) |

### General system features
| Requirement | Implementation |
|---|---|
| Real-time updates: schedules, booth allocations, event changes | Socket.IO rooms (`sockets/index.js`); `useLiveBooths`, `schedule:updated`, `expo:updated` |
| Feedback mechanism: suggestions / report issues | `POST /feedback`, `shared/FeedbackPage.jsx`, `admin/FeedbackAdmin.jsx` |

## B. Non-functional requirements

| Category | Requirement | How it is met |
|---|---|---|
| Performance | 1–2 s response | Indexed queries, `.lean()` reads, aggregate stats (no N+1), gzip, pagination, code-split bundles, React Query caching |
| Scalability | Growth in users/data; hundreds of concurrent users; horizontal scaling | Stateless API, atomic DB ops, idempotent scheduler, Socket.IO adapter-ready, connection pool 50, PM2 cluster mode; see `DEPLOYMENT.md` §6 |
| Security — encryption | Passwords & sensitive data protected at rest & in transit | bcrypt, HMAC-hashed tokens, TLS to Atlas, HTTPS deployment guide, Secure/httpOnly cookies |
| Security — authentication | Industry-standard | JWT access + rotating refresh tokens, lock-out, rate limiting (T) |
| Security — authorization | Users access only their own or public data | RBAC + ownership checks everywhere (T isolation tests) |
| Privacy — GDPR | Data privacy & user consent | Consent capture, export, erasure, minimisation, TTL retention (`SECURITY.md` §6) |
| Reliability — uptime | ≥ 99 % | Health endpoint, graceful shutdown, auto-reconnect, PM2 auto-restart |
| Reliability — backups | Regular automated backups | `npm run backup [-- --keep=N]` + restore; schedule + Atlas Cloud Backup |
| Usability | Intuitive, consistent, responsive UI | Design system (`UI_DESIGN_SYSTEM.md`), role-specific portals, empty/error/loading states |
| Accessibility | WCAG | AA contrast tokens, labels, ARIA, focus management, keyboard floor plan, reduced motion |
| Compatibility | Chrome, Firefox, Safari, Edge; mobile | Evergreen browser targets via Vite; mobile-first layouts, bottom tab bar |
| Monitoring | Logging & monitoring | morgan + structured logger, central error handler, `/api/health` |
| Testing & QA | Unit / integration / E2E; security testing | 20 integration tests, manual E2E script, security & a11y checklists (`TESTING.md`) |
| Documentation | User docs, developer docs, video | `README.md`, `docs/*` (this set). **Video:** record with the script in `TESTING.md` §3 |

## C. UI/UX brief

| Requirement | Where |
|---|---|
| Three dedicated flows / dashboards | `/admin`, `/exhibitor`, `/attendee` portals |
| Organizer: sidebar nav, data tables with filters, interactive cards, analytics widgets, booth heatmaps | `DashboardLayout`, `DataTable`, `Analytics.jsx` |
| Exhibitor: card layouts, status badges (Booth Confirmed, Pending Approval) | `StatusBadge`, dashboard & booth cards |
| Attendee: engaging, fast, light/dark toggle | `AttendeeLayout`, `ThemeToggle` |
| Interactive floor plan with green / red / blue colour code, used by all roles | `components/FloorPlan.jsx` (modes admin / select / view / heatmap) |
| Multi-role login & security UI with immediate routing | `RoleSelector`, `Login.jsx`, `Register.jsx` |
| Palette (#4F46E5 indigo), Plus Jakarta Sans, strict type scale | `frontend/src/index.css` |
| Smooth micro-interactions | **GSAP** across the app (`lib/motion.js`, hooks, pages) |
| Deliverables: component breakdown, wireframes, floor-plan layouts, Tailwind guidelines | `docs/UI_DESIGN_SYSTEM.md` |

## D. Project-submission deliverables

| Deliverable | Location |
|---|---|
| Complete source code | `backend/`, `frontend/` |
| Documentation incl. login credentials | `README.md`, `docs/` |
| Database backup | `backend/backups/<timestamp>/*.json` (+ scripts) |
| Video of the working app | to be recorded (script in `docs/TESTING.md`) |

## E. Known limitations & suggested next steps

* Socket.IO needs the Redis adapter (or sticky sessions) when running more than one API instance.
* No payment gateway: booth prices are informational; invoicing would be a natural extension.
* Email delivery requires SMTP credentials in production.
