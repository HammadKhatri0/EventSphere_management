import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck2, Map, ShieldCheck, Sparkles } from 'lucide-react';
import { gsap, useGSAP, prefersReducedMotion } from '../../lib/motion.js';
import { Logo, ThemeToggle } from '../../components/layout/parts.jsx';

const POINTS = [
  [Map, 'Live interactive floor plans', 'Reserve, confirm and locate booths in real time.'],
  [CalendarCheck2, 'Schedules that stay in sync', 'Bookmarks, registrations and reminders for every session.'],
  [ShieldCheck, 'Secure by design', 'Role-based access, encrypted credentials and GDPR tools.'],
];

/** Two-column auth layout with an animated brand panel. */
export default function AuthShell({ title, subtitle, children, footer }) {
  const root = useRef(null);
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.as-point', { x: -24, opacity: 0, stagger: 0.12, duration: 0.6, delay: 0.15 })
      .from('.as-form > *', { y: 16, opacity: 0, stagger: 0.06, duration: 0.5 }, '<0.1');
    gsap.to('.as-orb', { y: 'random(-18, 18)', x: 'random(-14, 14)', duration: 'random(3, 5)', repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.4 });
  }, { scope: root });

  return (
    <div ref={root} className="min-h-dvh grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <a href="#auth-main" className="skip-link">Skip to form</a>
      <aside className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 text-white bg-gradient-to-br from-indigo-700 via-indigo-600 to-cyan-600">
        <span className="as-orb absolute -top-24 -right-16 size-80 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <span className="as-orb absolute bottom-10 -left-20 size-72 rounded-full bg-cyan-300/20 blur-2xl" aria-hidden />
        <Link to="/" className="relative z-10 inline-flex items-center gap-2.5 font-extrabold text-xl">
          <span className="size-10 rounded-xl bg-white/15 grid place-items-center backdrop-blur"><Sparkles className="size-5" aria-hidden /></span>EventSphere
        </Link>
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight text-white">Run unforgettable expos, end to end.</h2>
          <ul className="mt-8 space-y-5">
            {POINTS.map(([Icon, t, d]) => (
              <li key={t} className="as-point flex gap-4"><span className="size-11 rounded-xl bg-white/15 backdrop-blur grid place-items-center shrink-0"><Icon className="size-5" aria-hidden /></span><span><span className="block font-bold">{t}</span><span className="text-white/80 text-sm">{d}</span></span></li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-sm text-white/70">© {new Date().getFullYear()} EventSphere Management</p>
      </aside>

      <main id="auth-main" className="flex flex-col px-5 sm:px-10 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="lg:hidden" aria-label="EventSphere home"><Logo /></Link>
          <span className="hidden lg:block" />
          <ThemeToggle />
        </div>
        <div className="flex-1 grid place-items-center py-8">
          <div className="w-full max-w-[460px] as-form">
            <h1 className="text-3xl font-extrabold">{title}</h1>
            {subtitle && <p className="text-muted mt-2">{subtitle}</p>}
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-6 text-sm text-center text-muted">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
