# Testing & Quality Assurance

## 1. Strategy

| Level | Tooling | Status |
|---|---|---|
| Unit / integration (API) | Node's built-in test runner + **supertest** + **mongodb-memory-server** (a real MongoDB engine in memory — no mocking of the DB, Atlas is never touched) | ✅ 20 tests in `backend/tests/` |
| Static checks | `node --check`, Vite production build must pass (`npm run build`) | ✅ |
| End-to-end (manual script) | Section 3 below; follows the three role journeys | Provided |
| Security | Automated cases (see `SECURITY.md` §8) + checklist §4 | Partly automated |
| Accessibility | Keyboard-only walkthrough + axe/Lighthouse (§5) | Checklist |
| Performance | Response-time targets §6 | Checklist |

## 2. Running the automated tests

```bash
cd backend
npm test
```

The first run downloads a MongoDB binary (~100 MB, cached afterwards). Expected result: **20 passing**.

| Suite | What it proves |
|---|---|
| `auth.test.js` | registration per role, organizer invite code, weak password / missing consent / duplicate email, role-vs-portal login check, NoSQL-injection payload rejected, token required, refresh rotation + re-use rejection, account lock-out, password-reset flow (single use, no enumeration) |
| `workflow.test.js` | RBAC on organizer routes, floor-plan bulk generation + bounds + overlap rules, application approval gate before booth reservation, **race-free booth reservation** (two exhibitors, one booth → exactly one `200` + one `409`), public floor-plan privacy, directory, draft expo hiding, session room-clash `409`, **no overselling** of session seats, once-only reminder delivery, ticket isolation between exhibitors, analytics ownership + CSV, GDPR export + erase, 404/400 handling, health endpoint |

## 3. Manual end-to-end script (≈ 15 min)

Use the demo accounts from `DEPLOYMENT.md`. Real-time checks need two browser windows.

| # | Role | Steps | Expected |
|---|---|---|---|
| 1 | – | Open `/`, toggle dark mode | Landing page animates in; theme persists on reload |
| 2 | – | `/register` as **Attendee** with a weak password | Inline checklist blocks submit; strong password succeeds and lands on `/attendee` |
| 3 | – | `/login`, pick **Organizer**, use an attendee's credentials | "This account is registered as an attendee…" |
| 4 | Organizer | Sign in → *Expo events* → **New expo** (fill fields, end date before start) | Validation message; fixed form creates expo and opens its floor plan |
| 5 | Organizer | *Floor plan* → **Generate grid** (2 × 4) → drag a booth onto another | Booths appear; overlap is refused (red dashed outline) |
| 6 | Exhibitor 2 | *Booth selection* → pick an open booth → **Reserve** | Booth turns amber "Pending Approval" in **both** windows instantly |
| 7 | Organizer | Floor plan → select the amber booth → **Confirm** | Turns red "Booth Confirmed"; exhibitor gets a notification |
| 8 | Exhibitor 2 | *Staff* → add a person; *Profile* → upload logo + product | Saved, visible in attendee directory after booth confirmation |
| 9 | Organizer | *Applications* → reject one with no reason; then with a reason | Reason required; exhibitor sees it on *My applications* |
| 10 | Organizer | *Schedule* → add a session in an occupied room/time | Conflict message shown |
| 11 | Attendee | *Schedule* → bookmark + register (reminder 15 min) a session; register for a full one | Agenda updated; full session refused |
| 12 | Attendee | *Exhibitors* → search "cloud" → open TechNova → **Book appointment** | Exhibitor receives notification; thread visible in *Visitor inquiries* |
| 13 | Exhibitor | Accept the appointment; reply | Attendee sees status + reply live |
| 14 | Exhibitor | *Exhibitor messages* → find neighbours → message | Chat updates live in the other exhibitor's window |
| 15 | Exhibitor | *Support* → new ticket; Organizer replies | Thread updates both ways, status badges change |
| 16 | Organizer | *Analytics* → open expo; click a few booths as an attendee | KPIs/heatmap update live ("Live" indicator); CSV downloads |
| 17 | Any | *Account & privacy* → Export data; change password | JSON downloaded; other sessions signed out |
| 18 | Any | Stop the API, reload | Friendly error states, no blank page; recovers when restarted |

## 4. Security test checklist

- [ ] Call any `/api/*` write route without a token → `401`.
- [ ] Call organizer routes with an attendee token → `403`.
- [ ] Fetch another user's ticket / inquiry id → `404`.
- [ ] `POST /auth/login` with `{"email":{"$gt":""},"password":{"$gt":""}}` → `400`.
- [ ] Register with `"role":"admin"` and no/incorrect code → `403`.
- [ ] Upload a `.exe` renamed `.png` → `400` (signature check).
- [ ] 6 wrong passwords → account locked (`423`) for 15 minutes.
- [ ] Replay an old refresh cookie → `401`, session family revoked.
- [ ] Inspect response headers: `Content-Security-Policy`, `X-Content-Type-Options`, no `X-Powered-By`.
- [ ] `npm audit` on both packages.

## 5. Accessibility checklist (WCAG 2.1 AA)

- [ ] Whole app usable with keyboard only (Tab / Shift-Tab / Enter / Space / Esc / arrow keys in tabs, role selector, floor plan).
- [ ] Visible focus on every control in light **and** dark themes.
- [ ] Skip-to-content link works on every layout.
- [ ] Forms: every field has a label, errors are announced (`role="alert"`) and linked via `aria-describedby`.
- [ ] Status is never colour-only (badges contain text, booths have patterns + labels).
- [ ] 200 % zoom and 360 px width without horizontal page scroll.
- [ ] `prefers-reduced-motion` disables GSAP sequences.
- [ ] Run Lighthouse / axe DevTools on login, attendee home, organizer dashboard: target ≥ 95 accessibility.

## 6. Performance targets

| Operation | Target |
|---|---|
| Typical API call (indexed query) | < 300 ms server time; < 1–2 s end-to-end |
| First load of landing page (gzip) | ≈ 190 KB JS total, route chunks lazy-loaded |
| Floor plan (≈ 100 booths) | renders and animates in < 1 s |
| Concurrency | stateless API; load-test with `npx autocannon -c 200 -d 30 http://localhost:5000/api/expos` (hundreds of concurrent connections) |

## 7. Requirement coverage

See `REQUIREMENTS_TRACEABILITY.md` for the mapping from every functional and non-functional requirement to implementation and test evidence.

## 8. Verification log (latest full click-through)

| Area | Result |
|---|---|
| Responsive audit | Every route of all three portals checked at **375 px (phone)** and **768 px (tablet)** for horizontal overflow and error states → none (a grid min-width bug on the organizer dashboard, analytics and floor-plan pages was found and fixed) |
| Auth | Register (attendee + exhibitor), validation messages, login by portal, session restore on reload, password change, data export, account deletion with wrong-password guard |
| Attendee | Expo register/cancel (with confirm), bookmark/register sessions, agenda + `.ics` export, floor-plan search/locate/booth details, inquiry & appointment form validation and submit |
| Exhibitor | Profile save with field errors, **logo upload to Cloudinary and removal**, staff add/remove, apply to expo + withdraw, **booth reserve → live "Booth Confirmed" update from organizer**, showcase edit, inquiries accept/reply, ticket create, B2B neighbour search and chat |
| Organizer | Application approve / reject-with-reason, floor plan (keyboard select, **mouse drag move**, release, assign), schedule create with room-conflict message, expo create/delete, analytics + CSV download, ticket reply |
| Fixes from this pass | Phone overflow on 3 pages · "My booths" now refreshes live · inquiry badge reads "Awaiting reply" · logo/banner/avatar/website can now be removed · pan hint for the floor plan on phones |
