import { useRef } from 'react';
import { Accessibility, ArrowRight, Building2, CalendarCheck2, CheckCircle2, ClipboardCheck, Layers, Lock, Map, ShieldCheck, Ticket, Users, Zap } from 'lucide-react';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/motion.js';
import { useScrollReveal } from '../hooks/index.js';
import { PublicFooter, SiteHeader } from '../components/layout/PublicShell.jsx';
import { Button } from '../components/ui/index.jsx';
import { HeroArcs } from './LandingArt.jsx';
import CtaBanner from './CtaBanner.jsx';

const GLANCE = [
  [Users, '3 role-based portals', 'Organizer, Exhibitor and Attendee — each with its own tools.'],
  [Zap, 'Live by default', 'Booths, schedules and notifications update the moment they change.'],
  [Lock, 'Private & secure', 'Hashed passwords, role-based access, data export and erasure.'],
  [Accessibility, 'Accessible everywhere', 'Keyboard friendly, WCAG AA contrast, phone to desktop.'],
];

const PROBLEMS = [
  ['Manual registration', 'Guided exhibitor applications with an approval queue, and one-click attendee and session registration.'],
  ['Scattered communication', 'Built-in inquiries, appointment booking, exhibitor-to-exhibitor messaging and support tickets.'],
  ['Little real-time information', 'A live floor plan, a shared schedule with reminders, and analytics that refresh as things happen.'],
];

const STEPS = [
  [Layers, 'Organizers set the stage', 'Create the expo, draw the floor plan, publish the schedule and open applications.'],
  [ClipboardCheck, 'Exhibitors apply', 'Companies build a profile, apply, and — once approved — pick and reserve a booth on the live map.'],
  [Ticket, 'Attendees plan their visit', 'Visitors register, search exhibitors, bookmark sessions and set reminders.'],
  [CalendarCheck2, 'Everyone stays in sync', 'Confirmations, changes and messages reach each person instantly, and organizers watch it all in analytics.'],
];

const ROLES = [
  { icon: Ticket, title: 'Organizers', chip: 'bg-primary', card: 'from-primary-soft dark:from-primary/30 border-primary/30 dark:border-primary/55', points: ['Create and configure expos', 'Allocate booths on an interactive floor plan', 'Approve exhibitors and manage the schedule', 'Track traffic, popularity and engagement'] },
  { icon: Building2, title: 'Exhibitors', chip: 'bg-info', card: 'from-info-soft dark:from-info/30 border-info/30 dark:border-info/55', points: ['Showcase company, products and documents', 'Select and reserve a booth in real time', 'Answer visitor inquiries and appointments', 'Message neighbours and contact organizers'] },
  { icon: Users, title: 'Attendees', chip: 'bg-success', card: 'from-success-soft dark:from-success/25 border-success/30 dark:border-success/55', points: ['Browse exhibitors with filters and search', 'Locate booths on the floor plan', 'Bookmark or register for sessions with reminders', 'Book appointments with exhibitors'] },
];

const PRINCIPLES = [
  [ShieldCheck, 'Secure by design', 'Salted password hashing, short-lived sessions that rotate, role-based access on every request and validated input everywhere.'],
  [Zap, 'Reliable under pressure', 'Booth reservations and session seats are atomic — two people can never take the same booth or the last seat.'],
  [Accessibility, 'Accessible & responsive', 'Built to WCAG AA contrast, fully keyboard operable, with layouts for phones, tablets and desktops, light and dark themes and eleven colour palettes.'],
  [Lock, 'Private by default', 'You control your data: explicit consent, a full data export and account deletion, with sensitive details kept out of public pages.'],
];

const STACK = ['MongoDB', 'Express', 'React', 'Node.js', 'Socket.IO', 'Tailwind CSS', 'GSAP', 'Cloudinary'];

function Heading({ label, children, text }) {
  return (
    <div className="max-w-2xl reveal-item">
      <p className="text-xs font-bold text-primary-text uppercase tracking-[0.18em]">{label}</p>
      <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 leading-tight">{children}</h2>
      {text && <p className="text-muted mt-3 text-lg">{text}</p>}
    </div>
  );
}

export default function About() {
  const root = useRef(null);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.from('.hero-badge', { y: 20, opacity: 0, duration: 0.6 })
      .from('.hero-word', { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.07 }, '<0.1')
      .from('.hero-sub', { y: 20, opacity: 0, duration: 0.7 }, '-=0.5')
      .from('.hero-card', { y: 30, opacity: 0, duration: 0.8 }, '-=0.8');
    gsap.to('.cta-art', { y: -10, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }, { scope: root });
  useScrollReveal(root);

  const headline = ['Built', 'to', 'make', 'every', 'expo', 'run', 'smoothly.'];

  return (
    <div ref={root} className="landing-page min-h-dvh">
      <a href="#content" className="skip-link">Skip to content</a>
      <SiteHeader overlay />

      <main id="content" tabIndex={-1} className="focus:outline-none">
        {/* ----------------------------------------------------------------- hero */}
        <section className="hero-bg relative pt-32 pb-24 overflow-hidden">
          <HeroArcs className="absolute right-0 top-0 h-[600px] w-[640px] max-w-full pointer-events-none opacity-50 dark:opacity-90" />
          <div className="relative max-w-6xl mx-auto px-5 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
            <div>
              <span className="hero-badge inline-flex rounded-full border border-primary/30 bg-primary-soft px-3.5 py-1.5 text-[13px] font-semibold text-primary-text">About EventSphere</span>
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight" aria-label="Built to make every expo run smoothly.">
                {headline.map((w, i) => (
                  <span key={`${w}${i}`} className="inline-block overflow-hidden align-bottom pr-3 pb-1" aria-hidden>
                    <span className={`hero-word inline-block ${i > 4 ? 'gradient-text' : ''}`}>{w}</span>
                  </span>
                ))}
              </h1>
              <p className="hero-sub mt-6 text-lg text-muted max-w-xl">EventSphere is one secure platform where organizers, exhibitors and attendees come together — replacing spreadsheets, scattered emails and guesswork with live floor plans, shared schedules and clear communication.</p>
              <div className="hero-sub mt-8 flex flex-wrap gap-3">
                <Button size="lg" to="/register" icon={ArrowRight}>Get started</Button>
                <Button size="lg" variant="secondary" to="/help">Visit the Help Center</Button>
              </div>
            </div>

            <div className="hero-card glass-card p-6 sm:p-7">
              <p className="text-sm font-bold mb-4">At a glance</p>
              <ul className="space-y-5">
                {GLANCE.map(([Icon, t, d]) => (
                  <li key={t} className="flex gap-4">
                    <span className="size-11 rounded-xl bg-primary-soft text-primary-text border border-primary/20 grid place-items-center shrink-0"><Icon className="size-5" aria-hidden /></span>
                    <span><span className="block font-bold">{t}</span><span className="text-muted text-sm">{d}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- problem */}
        <section className="reveal-section border-t border-line/60" aria-labelledby="why-h">
          <div className="max-w-6xl mx-auto px-5 py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-start">
            <Heading label="Why EventSphere" text="Large expos and trade shows run on manual registration, disjointed channels and information that is out of date the moment it is sent. We built EventSphere to change that.">
              <span id="why-h">Expos shouldn&rsquo;t run on <span className="gradient-text">spreadsheets.</span></span>
            </Heading>
            <ul className="space-y-4">
              {PROBLEMS.map(([problem, fix]) => (
                <li key={problem} className="reveal-item glass-card p-5 flex gap-4">
                  <CheckCircle2 className="size-6 text-success shrink-0 mt-0.5" aria-hidden />
                  <div><p className="text-sm text-muted line-through decoration-muted/50">{problem}</p><p className="font-semibold mt-1">{fix}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ----------------------------------------------------------- how it works */}
        <section className="reveal-section landing-band py-20" aria-labelledby="how-h">
          <div className="max-w-6xl mx-auto px-5">
            <Heading label="How it works" text="From the first floor-plan sketch to the closing keynote, everyone works from the same live picture.">
              <span id="how-h">Four steps from plan to <span className="gradient-text">packed hall.</span></span>
            </Heading>
            <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {STEPS.map(([Icon, t, d], i) => (
                <li key={t} className="reveal-item glass-card p-6 relative">
                  <span className="absolute top-4 right-5 text-4xl font-extrabold text-primary-text/15" aria-hidden>{i + 1}</span>
                  <span className="size-11 rounded-xl bg-primary text-white grid place-items-center shadow-md"><Icon className="size-5" aria-hidden /></span>
                  <h3 className="mt-5 text-lg font-bold">{t}</h3>
                  <p className="text-muted mt-2 text-sm leading-relaxed">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------- audiences */}
        <section className="reveal-section" aria-labelledby="who-h">
          <div className="max-w-6xl mx-auto px-5 py-20">
            <Heading label="Who it's for" text="One platform, three portals. People sign in as who they are and land in the right place.">
              <span id="who-h">Tools for every role at the <span className="gradient-text">expo.</span></span>
            </Heading>
            <div className="mt-12 grid md:grid-cols-3 gap-5">
              {ROLES.map(({ icon: Icon, title, chip, card, points }) => (
                <div key={title} className={`reveal-item rounded-2xl border bg-gradient-to-br ${card} to-surface p-7 shadow-card`}>
                  <span className={`size-12 rounded-full ${chip} text-white grid place-items-center shadow-md`}><Icon className="size-6" aria-hidden /></span>
                  <h3 className="mt-5 text-xl font-bold">{title}</h3>
                  <ul className="mt-4 space-y-2.5 text-sm text-muted">
                    {points.map((p) => <li key={p} className="flex gap-2.5"><CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" aria-hidden />{p}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ principles */}
        <section className="reveal-section landing-band py-20" aria-labelledby="values-h">
          <div className="max-w-6xl mx-auto px-5">
            <Heading label="What we stand for">
              <span id="values-h">Built on principles you can <span className="gradient-text">rely on.</span></span>
            </Heading>
            <div className="mt-12 grid sm:grid-cols-2 gap-5">
              {PRINCIPLES.map(([Icon, t, d]) => (
                <div key={t} className="reveal-item glass-card p-6 flex gap-5">
                  <span className="size-12 rounded-2xl bg-primary-soft text-primary-text border border-primary/20 grid place-items-center shrink-0"><Icon className="size-6" aria-hidden /></span>
                  <div><h3 className="text-lg font-bold">{t}</h3><p className="text-muted mt-1.5 leading-relaxed">{d}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ technology */}
        <section className="reveal-section" aria-labelledby="tech-h">
          <div className="max-w-6xl mx-auto px-5 py-20">
            <Heading label="Technology" text="EventSphere is a MERN application with a clean MVC structure — a stateless API, a real-time layer and a fast single-page front end.">
              <span id="tech-h">Modern, proven, and <span className="gradient-text">built to scale.</span></span>
            </Heading>
            <ul className="mt-10 flex flex-wrap gap-3">
              {STACK.map((t) => <li key={t} className="reveal-item"><span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold shadow-card"><Map className="size-4 text-primary-text" aria-hidden />{t}</span></li>)}
            </ul>
          </div>
        </section>

        <CtaBanner title="Ready to see it in action?" text="Create a free account and explore the platform as an organizer, exhibitor or attendee." />
      </main>

      <PublicFooter />
    </div>
  );
}
