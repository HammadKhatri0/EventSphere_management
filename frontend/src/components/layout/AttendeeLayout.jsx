import { Link, NavLink, Outlet } from 'react-router-dom';
import { Bookmark, CalendarDays, Home, Map, MessageSquare, Search, Ticket } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Logo, NotificationBell, ThemeToggle, UserMenu } from './parts.jsx';
import { PageTransition } from './DashboardLayout.jsx';

const NAV = [
  { to: '/attendee', label: 'Home', icon: Home, end: true },
  { to: '/attendee/expos', label: 'Expos', icon: Ticket },
  { to: '/attendee/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/attendee/exhibitors', label: 'Exhibitors', icon: Search },
  { to: '/attendee/floor-plan', label: 'Floor plan', icon: Map },
  { to: '/attendee/agenda', label: 'My agenda', icon: Bookmark },
  { to: '/attendee/inquiries', label: 'Inquiries', icon: MessageSquare },
];
const MOBILE = [NAV[0], NAV[2], NAV[3], NAV[4], NAV[5]];

export default function AttendeeLayout() {
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-lg border-b border-line">
        <div className="max-w-[1280px] mx-auto h-16 px-4 sm:px-6 flex items-center gap-4">
          <Link to="/attendee" aria-label="EventSphere home"><Logo /></Link>
          <nav aria-label="Main" className="hidden md:flex items-center gap-1 ml-4">
            {NAV.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cn('px-3 py-2 rounded-xl text-sm font-semibold transition', isActive ? 'bg-primary-soft text-primary-text' : 'text-muted hover:text-fg hover:bg-surface-2')}>{i.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1"><ThemeToggle /><NotificationBell allHref="/attendee/notifications" /><UserMenu settingsHref="/attendee/settings" /></div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8 focus:outline-none">
        <PageTransition><Outlet /></PageTransition>
      </main>

      <footer className="hidden md:block border-t border-line mt-10 py-6 text-sm text-muted">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-wrap justify-between gap-3">
          <span>© {new Date().getFullYear()} EventSphere Management</span>
          <span className="flex gap-4"><Link to="/attendee/feedback" className="hover:text-fg">Feedback &amp; support</Link><Link to="/attendee/settings" className="hover:text-fg">Privacy</Link></span>
        </div>
      </footer>

      <nav aria-label="Primary mobile" className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {MOBILE.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', isActive ? 'text-primary-text' : 'text-muted')}>
            <i.icon className="size-5" aria-hidden />{i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
