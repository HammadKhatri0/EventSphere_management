import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { gsap, prefersReducedMotion } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';
import { Logo, NotificationBell, ThemeToggle, UserMenu } from './parts.jsx';
import { IconButton } from '../ui/index.jsx';

/** Page content wrapper that fades/slides in on every route change (GSAP). */
export function PageTransition({ children }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    gsap.fromTo(ref.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, clearProps: 'transform,opacity' });
    const items = ref.current.querySelectorAll('[data-reveal]');
    if (items.length) gsap.fromTo(items, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, delay: 0.05, clearProps: 'transform,opacity' });
  }, [pathname]);
  return <div ref={ref}>{children}</div>;
}

/**
 * Sidebar shell for the organizer and exhibitor portals.
 * nav: [{ to, label, icon, end?, group? }]
 */
export default function DashboardLayout({ nav, portal, settingsHref, notificationsHref }) {
  const [open, setOpen] = useState(false);
  const drawer = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!drawer.current || prefersReducedMotion()) return;
    if (open) gsap.fromTo(drawer.current, { x: -288 }, { x: 0, duration: 0.3, ease: 'power3.out' });
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const links = (
    <nav aria-label={`${portal} navigation`} className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {Object.entries(nav.reduce((m, i) => { (m[i.group || ''] ||= []).push(i); return m; }, {})).map(([group, items]) => (
        <div key={group}>
          {group && <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{group}</p>}
          <ul className="space-y-0.5">
            {items.map((i) => (
              <li key={i.to}>
                <NavLink to={i.to} end={i.end} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-primary-soft text-primary-text' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
                  <i.icon className="size-[18px] shrink-0" aria-hidden />{i.label}
                  {i.badge ? <span className="ml-auto rounded-full bg-danger text-white text-[11px] px-1.5 min-w-5 text-center">{i.badge}</span> : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
  const brand = (<div className="h-16 flex items-center px-5 border-b border-line shrink-0"><Logo /><span className="ml-2 text-[11px] font-bold uppercase tracking-wider rounded-md bg-primary-soft text-primary-text px-1.5 py-0.5">{portal}</span></div>);

  return (
    <div className="min-h-dvh lg:pl-64">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-surface border-r border-line z-30">{brand}{links}</aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <aside ref={drawer} className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-surface border-r border-line" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="flex items-center justify-between pr-2">{brand}<IconButton label="Close menu" icon={X} onClick={() => setOpen(false)} /></div>
            {links}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 h-16 bg-bg/80 backdrop-blur-lg border-b border-line flex items-center gap-2 px-4 sm:px-6">
        <IconButton label="Open menu" icon={Menu} className="lg:hidden" onClick={() => setOpen(true)} aria-expanded={open} />
        <div className="lg:hidden"><Logo compact /></div>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell allHref={notificationsHref} />
          <UserMenu settingsHref={settingsHref} />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1400px] mx-auto focus:outline-none">
        <PageTransition><Outlet /></PageTransition>
      </main>
    </div>
  );
}
