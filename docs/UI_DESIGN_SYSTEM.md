# UI / UX Design System & Wireframes

EventSphere serves three audiences through three dedicated portals that share one design system. This document covers the component breakdown, wireframes, the interactive floor-plan layouts and the Tailwind guidelines used to build them.

## 1. Design principles

| Principle | How it shows up |
|---|---|
| Corporate, modern, spacious (Eventbrite / Hopin inspired) | Large radii (`rounded-2xl`), soft shadows, generous whitespace, high contrast |
| Role-appropriate density | Organizer: data-dense tables & KPIs · Exhibitor: card-based, status-badge driven · Attendee: consumer-friendly, fast, mobile-first |
| Accessible by default (WCAG 2.1 AA) | ≥ 4.5:1 text contrast in both themes, visible 3 px focus ring, labelled controls, `aria-live` status text, keyboard-operable floor plan, skip links, reduced-motion support |
| Meaningful motion | GSAP: staggered page/card reveals, count-up KPIs, sliding role selector, booth pop-in, chart draw-in, modal spring. All disabled for `prefers-reduced-motion` users |
| Theming | Light / dark toggle (stored locally, honours OS preference, no flash on load) |

## 2. Tokens

Defined once in `frontend/src/index.css` as CSS variables and exposed to Tailwind v4 through `@theme inline`, so the dark theme needs **no `dark:` variants** in components.

| Token (Tailwind class) | Light | Dark | Use |
|---|---|---|---|
| `bg-bg` | `#F5F6FA` | `#0A0F1F` | Page background |
| `bg-surface` / `bg-surface-2` | `#FFFFFF` / `#F1F3F9` | `#121A2F` / `#1A2440` | Cards / subtle fills |
| `border-line` | `#DFE3EE` | `#28345A` | Borders, dividers |
| `text-fg` / `text-muted` | `#0F172A` / `#53607A` | `#E8ECF8` / `#9AA8C7` | Primary / secondary text (≥ 4.5:1) |
| `bg-primary` | `#4F46E5` (indigo) | `#4F46E5` | Primary actions (white text 6.3:1) |
| `text-primary-text`, `bg-primary-soft` | `#4338CA`, `#EEF2FF` | `#A5B4FC`, indigo 16 % | Links, active nav, soft chips |
| `success`, `warning`, `danger`, `info` (+ `-soft`, `-text`) | green / amber / red / blue | lighter text on translucent fills | Status feedback |

Typography: **Plus Jakarta Sans** (fallback Inter / system UI). Scale — display `text-4xl–6xl extrabold`, page title `text-2xl/3xl extrabold`, card title `text-base bold`, body `15 px`, helper `13 px`. Letter-spacing `-0.02em` on headings.

Booth colour code (also encoded by pattern + text so colour is never the only cue):

| State | Colour | Extra cue | Label |
|---|---|---|---|
| Available | green | solid | "Open" |
| Occupied / confirmed | red | solid + company name | "Booth Confirmed" |
| Pending approval | amber | diagonal stripes | "Pending Approval" |
| Selected | blue | thick outline + pulse | "Selected" |
| Blocked | grey | cross-hatch | "Blocked" |
| Yours | indigo outline | "YOURS" tag | – |

## 3. Component library (`frontend/src/components`)

| Group | Components |
|---|---|
| Primitives (`ui/`) | `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Toggle`, `SearchInput`, `FileUpload`, `Badge`/`StatusBadge`, `Avatar`, `ProgressBar`, `Tabs` (arrow-key nav), `Chips`, `Pagination`, `DataTable`, `Dl`, `Alert` |
| Feedback | `Modal` (focus trap, Esc, scroll-lock, focus restore), `ConfirmModal`, toasts (Sonner), `Spinner`, `Skeleton`, `EmptyState`, `ErrorState` |
| Layout | `DashboardLayout` (sidebar + top bar, mobile drawer), `AttendeeLayout` (top nav + mobile bottom tab bar), `PageTransition`, `Guards` (role routing) |
| Domain | `FloorPlan` (+ legend), `StatCard`, charts (`LineChart`, `BarList`, `Donut`), `NotificationBell`, `ThemeToggle`, `UserMenu`, `RoleSelector` |

## 4. Wireframes

### 4.1 Login / registration (all roles)

```
┌──────────────────────────────┬─────────────────────────────────────────┐
│  ▣ EventSphere               │                                    ☀    │
│                              │   Welcome back                          │
│  Run unforgettable expos,    │   Sign in to your EventSphere portal.   │
│  end to end.                 │                                         │
│                              │   I am signing in as                    │
│  ▫ Live interactive floor    │   ┌───────────┬───────────┬──────────┐  │
│    plans                     │   │ Organizer │ Exhibitor │ Attendee │  │
│  ▫ Schedules in sync         │   └───────────┴───────────┴──────────┘  │
│  ▫ Secure by design          │   Email    [______________________]     │
│                              │   Password [______________________] 👁   │
│  (animated gradient panel)   │                   Forgot password?      │
│                              │   [        Sign in as Attendee      ]   │
│                              │   New here? Create an account           │
└──────────────────────────────┴─────────────────────────────────────────┘
 Selecting a role slides the highlight; after sign-in the user lands directly in /admin, /exhibitor or /attendee.
 Register adds: company (exhibitor), organizer access code (organizer), password-rule checklist, consent boxes.
```

### 4.2 Organizer dashboard

```
┌ sidebar ──────┬──────────────────────────────────────────────────────────┐
│ ▣ EventSphere │  ☰                                   ☀  🔔3  (OR) Olivia │
│ OVERVIEW      ├──────────────────────────────────────────────────────────┤
│ ▸ Dashboard   │  Good morning, Olivia          [+ New expo] [Review apps]│
│   Analytics   │ ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐        │
│ MANAGE        │ │Expos 4 ││Attend. ││Pending ││Tickets ││Revenue │  KPI   │
│   Expo events │ │        ││  29    ││ apps 2 ││ open 2 ││ $27k   │  cards │
│   Floor plan  │ └────────┘└────────┘└────────┘└────────┘└────────┘        │
│   Applications│ ┌ Registrations (line) ──────────┐ ┌ Booth status ─────┐ │
│   Schedule    │ │   ╱╲_╱╲___╱‾‾‾                 │ │  (donut)          │ │
│ PEOPLE        │ └────────────────────────────────┘ └───────────────────┘ │
│   Support     │ ┌ Pending applications (table) ──┐ ┌ Session popularity ┐│
│   Users       │ │ Company · Expo · Date · [✔][✖] │ │ ▇▇▇▇▇▇▇  Keynote   ││
│   Feedback    │ └────────────────────────────────┘ └────────────────────┘│
└───────────────┴──────────────────────────────────────────────────────────┘
```

### 4.3 Exhibitor portal

```
┌ sidebar ──────┬──────────────────────────────────────────────────────────┐
│ Dashboard     │  Welcome, TechNova            Profile completeness ▓▓▓░ 67%│
│ Find expos    │ ┌ Global Tech Expo 2026 ────────────────────────────────┐ │
│ Applications  │ │ [Approved ✔]   Booth A6  [Booth Confirmed]            │ │
│ Booth select. │ └───────────────────────────────────────────────────────┘ │
│ Company profile ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│ Staff         │ │Visits 84│ │Inquir. 2│ │Unread 1 │ │Tickets 1│          │
│ Inquiries     │ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│ Messages      │  Next step cards: "Reserve your booth", "Complete profile"│
│ Support       │                                                          │
└───────────────┴──────────────────────────────────────────────────────────┘
```

### 4.4 Attendee interface (desktop → mobile)

```
Desktop                                              Mobile
┌──────────────────────────────────────────────┐    ┌───────────────┐
│ ▣ EventSphere  Home Expos Schedule … ☀ 🔔 (AM)│    │ ▣        ☀ 🔔 │
├──────────────────────────────────────────────┤    ├───────────────┤
│  ┌ HERO ───────────────────────────────────┐ │    │ HERO          │
│  │ Global Tech Expo 2026   ⏱ 14d 03h 22m    │ │    │ Countdown     │
│  │ Building the Intelligent Future          │ │    │ [Register]    │
│  │ [Register for this expo]  📍 Singapore   │ │    ├───────────────┤
│  └──────────────────────────────────────────┘ │    │ Upcoming      │
│  Upcoming sessions   │  Featured exhibitors   │    │ sessions (↕)  │
│  ▢ 09:00 Keynote  ☆  │  ▢ TechNova  A6        │    │ Exhibitors    │
└──────────────────────────────────────────────┘    ├───────────────┤
                                                     │🏠 📅 🔍 🗺 ⭐ │ ← bottom tab bar
                                                     └───────────────┘
```

## 5. Interactive floor-plan layouts

One `FloorPlan` component (`frontend/src/components/FloorPlan.jsx`, SVG) serves every role through a `mode` prop:

```
 ┌─ Zoom − 100% + ⤢ ───────────────────────────────────────────────┐
 │ ┌ Hall A ────────────────────────────┐                          │
 │ │ [A1][A2][A3] [A4][A5][A6] [A7][A8] │   ■ Available  (green)   │
 │ │ [A9]…                              │   ■ Occupied   (red)     │
 │ └─────────────────────────────────────┘   ▨ Pending    (amber)   │
 │ ┌ Hall B ────────────────────────────┐   ■ Selected   (blue)    │
 │ │ [B1][B2]…                          │   ▒ Blocked    (grey)     │
 │ └─────────────────────────────────────┘                          │
 │               ▇▇ ENTRANCE ▇▇                                      │
 └──────────────────────────────────────────────────────────────────┘
```

| Mode | Used by | Behaviour |
|---|---|---|
| `admin` | Organizer › Floor plan & booths | Click to inspect/edit, **drag to move** (snaps to grid, red dashed outline when overlapping), Shift + arrow keys as keyboard alternative. Side panel: confirm / release / assign / block / delete. Bulk "Generate grid". |
| `select` | Exhibitor › Booth selection | Only available booths are selectable (others dimmed); selection turns blue with a pulse; panel shows price/size → **Reserve**. Updates live if someone else takes the booth. |
| `view` | Attendee › Floor plan, expo & exhibitor pages | Click a booth for exhibitor details; "locate" highlights a booth with a pulsing ring; a text directory below is the non-visual alternative. |
| `heatmap` | Organizer › Analytics | Booths shaded by visit count with legend gradient and per-booth tooltip. |

Accessibility of the plan: each booth is `role="button"` with an `aria-label` such as *"Booth A6, booked, TechNova Solutions, Hall A"*; Tab/Enter/Space operate it; tooltips also appear on keyboard focus; status is conveyed by text + pattern in addition to colour.

## 6. Tailwind CSS guidelines used

1. **Semantic tokens over raw colours** – write `bg-surface text-fg border-line`, never `bg-white`/`slate-900`; dark mode comes for free.
2. **Mobile-first responsive** – base styles for 360 px, then `sm:` (640), `lg:` (1024, sidebar appears), `xl:` (1280, two-column dashboards). Data tables scroll horizontally inside `DataTable`; forms use `grid sm:grid-cols-2 gap-4`.
3. **Spacing rhythm** – 4-pt scale; cards `p-5/p-6`, page gutters `px-4 sm:px-6 lg:px-8`, sections `gap-6`.
4. **Component classes** – only a few shared recipes live in `@layer components` (`card`, `skip-link`, `gradient-text`, `hero-bg`); everything else is composed in React components with a tiny `cn()` helper.
5. **States** – every interactive element defines hover, `active:scale-[0.98]`, `disabled:` and a global `:focus-visible` ring (3 px, high contrast in both themes).
6. **Motion** – CSS only for micro-transitions (`transition`, 150–200 ms); orchestrated sequences use GSAP and are skipped when `prefers-reduced-motion: reduce`.
7. **Icons** – `lucide-react`, always `aria-hidden` unless they are the only label (then `aria-label` on the button).
