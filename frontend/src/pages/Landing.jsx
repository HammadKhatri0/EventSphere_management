import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BarChart3, Building2, CalendarClock, Map, MapPin, MessagesSquare, ShieldCheck, Ticket } from 'lucide-react';
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from '../lib/motion.js';
import { get } from '../lib/api.js';
import { fmtRange } from '../lib/utils.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_HOME } from '../lib/utils.js';
import { Logo, ThemeToggle } from '../components/layout/parts.jsx';
import { Button, Badge } from '../components/ui/index.jsx';

const FEATURES = [
  [Map, 'Interactive floor plans', 'Exhibitors pick booths, organizers confirm, attendees find their way — all on one live map.'],
  [CalendarClock, 'Smart scheduling', 'Conflict-free sessions, speaker assignments, bookmarks and reminders.'],
  [BarChart3, 'Real-time analytics', 'Booth traffic heatmaps, session popularity and engagement as it happens.'],
  [MessagesSquare, 'Built-in communication', 'Support tickets, B2B messaging and attendee appointment booking.'],
  [ShieldCheck, 'Secure & private', 'Role-based access, hashed passwords, rotating sessions and GDPR data tools.'],
  [Building2, 'Made to scale', 'Stateless API, indexed queries and a real-time layer ready for hundreds of concurrent users.'],
];

const ROLES = [
  ['Organizers', 'Create expos, allocate booths, approve exhibitors, run the schedule and watch analytics live.', Ticket, 'admin'],
  ['Exhibitors', 'Apply, reserve your booth on the map, showcase products and connect with neighbours and visitors.', Building2, 'exhibitor'],
  ['Attendees', 'Discover exhibitors, bookmark sessions, set reminders and book appointments.', MapPin, 'attendee'],
];

// decorative mini floor plan: [x, y, status]
const MINI = Array.from({ length: 24 }, (_, i) => [i % 6, Math.floor(i / 6), ['available', 'booked', 'available', 'reserved', 'booked', 'available'][(i * 7 + (i >> 2)) % 6]]);
const MINI_STYLE = { available: 'bg-success/25 border-success', booked: 'bg-danger/25 border-danger', reserved: 'bg-warning/30 border-warning' };

export default function Landing() {
  const root = useRef(null);
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ['expos', 'landing'], queryFn: () => get('/expos', { upcoming: true, limit: 3 }) });

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.from('.hero-badge', { y: 20, opacity: 0, duration: 0.6 })
      .from('.hero-word', { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.07 }, '<0.1')
      .from('.hero-sub', { y: 20, opacity: 0, duration: 0.7 }, '-=0.5')
      .from('.hero-cta > *', { y: 16, opacity: 0, stagger: 0.1, duration: 0.6 }, '-=0.5')
      .from('.mini-booth', { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(2)', stagger: { amount: 0.8, grid: [4, 6], from: 'center' } }, '-=1');
    gsap.to('.float-card', { y: -10, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.6 });

    gsap.utils.toArray('.reveal-section').forEach((el) => {
      gsap.from(el.querySelectorAll('.reveal-item'), { y: 36, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 80%', once: true } });
    });
    return () => ScrollTrigger.getAll().forEach((t) => t.kill());
  }, { scope: root });

  const headline = 'Every expo, perfectly orchestrated.'.split(' ');

  return (
    <div ref={root} className="min-h-dvh">
      <a href="#content" className="skip-link">Skip to content</a>
      <header className="absolute top-0 inset-x-0 z-20">
        <div className="max-w-6xl mx-auto h-20 px-5 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? <Button to={ROLE_HOME[user.role]}>Open my portal</Button> : (<><Button variant="ghost" to="/login" className="hidden sm:inline-flex">Sign in</Button><Button to="/register">Get started</Button></>)}
          </div>
        </div>
      </header>

      <main id="content">
        <section className="hero-bg pt-36 pb-24 overflow-hidden">
          <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
            <div>
              <Badge tone="primary" className="hero-badge px-3.5 py-1.5 text-[13px]">Expo & trade-show management platform</Badge>
              <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight" aria-label="Every expo, perfectly orchestrated.">
                {headline.map((w, i) => (
                  <span key={i} className="inline-block overflow-hidden align-bottom pr-3" aria-hidden>
                    <span className={`hero-word inline-block ${i > 1 ? 'gradient-text' : ''}`}>{w}</span>
                  </span>
                ))}
              </h1>
              <p className="hero-sub mt-6 text-lg text-muted max-w-xl">EventSphere brings organizers, exhibitors and attendees together — floor plans, applications, schedules, messaging and analytics in one secure, real-time platform.</p>
              <div className="hero-cta mt-9 flex flex-wrap gap-3">
                <Button size="lg" to="/register" icon={ArrowRight}>Create free account</Button>
                <Button size="lg" variant="secondary" to="/login">Sign in</Button>
              </div>
            </div>

            <div className="relative" aria-hidden>
              <div className="card p-5 rotate-1">
                <div className="flex items-center justify-between mb-4"><p className="font-bold">Hall A · Live floor plan</p><span className="flex items-center gap-1.5 text-xs text-success-text font-semibold"><span className="size-2 rounded-full bg-success animate-pulse" />Live</span></div>
                <div className="grid grid-cols-6 gap-2.5">
                  {MINI.map(([x, y, s]) => <div key={`${x}${y}`} className={`mini-booth aspect-square rounded-lg border-2 ${MINI_STYLE[s]}`} />)}
                </div>
                <div className="flex gap-4 mt-4 text-xs text-muted"><span className="flex items-center gap-1.5"><i className="size-3 rounded bg-success/40 border border-success" />Available</span><span className="flex items-center gap-1.5"><i className="size-3 rounded bg-danger/40 border border-danger" />Occupied</span><span className="flex items-center gap-1.5"><i className="size-3 rounded bg-warning/40 border border-warning" />Pending</span></div>
              </div>
              <div className="float-card card absolute -left-6 -bottom-12 px-4 py-3 flex items-center gap-3"><span className="size-10 rounded-xl bg-success-soft text-success-text grid place-items-center"><ShieldCheck className="size-5" /></span><span><span className="block text-sm font-bold">Booth A6 confirmed</span><span className="text-xs text-muted">TechNova Solutions</span></span></div>
              <div className="float-card card absolute -right-4 -top-5 px-4 py-3 flex items-center gap-3"><span className="size-10 rounded-xl bg-primary-soft text-primary-text grid place-items-center"><BarChart3 className="size-5" /></span><span><span className="block text-sm font-bold">+248 registrations</span><span className="text-xs text-muted">last 7 days</span></span></div>
            </div>
          </div>
        </section>

        <section className="reveal-section max-w-6xl mx-auto px-5 py-20" aria-labelledby="features-h">
          <div className="max-w-2xl reveal-item"><p className="text-sm font-bold text-primary-text uppercase tracking-wider">Platform</p><h2 id="features-h" className="text-3xl sm:text-4xl font-extrabold mt-2">Everything an expo needs, nothing it doesn’t.</h2></div>
          <ul className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(([Icon, t, d]) => (
              <li key={t} className="reveal-item card p-6 hover:-translate-y-1 transition"><span className="size-12 rounded-2xl bg-primary-soft text-primary-text grid place-items-center"><Icon className="size-6" aria-hidden /></span><h3 className="mt-4 text-lg font-bold">{t}</h3><p className="text-muted mt-1.5">{d}</p></li>
            ))}
          </ul>
        </section>

        <section className="reveal-section bg-surface-2/60 border-y border-line py-20" aria-labelledby="roles-h">
          <div className="max-w-6xl mx-auto px-5">
            <div className="max-w-2xl reveal-item"><p className="text-sm font-bold text-primary-text uppercase tracking-wider">One platform, three portals</p><h2 id="roles-h" className="text-3xl sm:text-4xl font-extrabold mt-2">Sign in as who you are — land where you belong.</h2></div>
            <div className="mt-10 grid md:grid-cols-3 gap-5">
              {ROLES.map(([t, d, Icon, role]) => (
                <Link key={t} to="/login" state={{ role }} className="reveal-item card p-7 group hover:-translate-y-1 transition block">
                  <span className="size-12 rounded-2xl bg-primary text-white grid place-items-center"><Icon className="size-6" aria-hidden /></span>
                  <h3 className="mt-5 text-xl font-bold">{t}</h3><p className="text-muted mt-2">{d}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-primary-text">Sign in <ArrowRight className="size-4 group-hover:translate-x-1 transition" aria-hidden /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {!!data?.items?.length && (
          <section className="reveal-section max-w-6xl mx-auto px-5 py-20" aria-labelledby="expos-h">
            <h2 id="expos-h" className="reveal-item text-3xl sm:text-4xl font-extrabold">Upcoming expos</h2>
            <div className="mt-8 grid md:grid-cols-3 gap-5">
              {data.items.map((e) => (
                <Link key={e._id} to="/login" state={{ role: 'attendee' }} className="reveal-item card overflow-hidden group hover:-translate-y-1 transition">
                  <div className="h-28 bg-gradient-to-br from-indigo-600 to-cyan-500 p-4 flex items-end"><Badge className="bg-white/90 text-slate-800 border-transparent">{fmtRange(e.startDate, e.endDate)}</Badge></div>
                  <div className="p-5"><h3 className="font-bold text-lg">{e.title}</h3><p className="text-sm text-muted mt-1 flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{[e.location?.venue, e.location?.city].filter(Boolean).join(', ')}</p>{e.theme && <p className="text-sm mt-3 italic text-muted">“{e.theme}”</p>}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="reveal-section px-5 pb-24">
          <div className="reveal-item max-w-6xl mx-auto rounded-3xl bg-gradient-to-br from-indigo-700 to-cyan-600 text-white p-10 sm:p-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Ready to host your next expo?</h2>
            <p className="mt-3 text-white/85 max-w-xl mx-auto">Join organizers, exhibitors and attendees already using EventSphere.</p>
            <div className="mt-8 flex justify-center gap-3 flex-wrap"><Button size="lg" variant="secondary" to="/register" className="!text-slate-900 !bg-white !border-white">Get started free</Button><Button size="lg" variant="ghost" to="/login" className="text-white hover:bg-white/15">Sign in</Button></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8 text-sm text-muted"><div className="max-w-6xl mx-auto px-5 flex flex-wrap justify-between gap-3"><span>© {new Date().getFullYear()} EventSphere Management</span><span>Built with MongoDB · Express · React · Node.js</span></div></footer>
    </div>
  );
}
