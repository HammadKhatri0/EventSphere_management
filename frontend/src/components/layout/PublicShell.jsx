import { Link, NavLink } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaXTwitter, FaYoutube } from 'react-icons/fa6';
import { Logo, ThemeToggle } from './parts.jsx';
import { Button } from '../ui/index.jsx';
import { FOOTER_TAGLINE, SOCIAL_LINKS } from '../../lib/siteConfig.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_HOME, cn } from '../../lib/utils.js';

/** Top bar for the public marketing pages. `overlay` floats it over a hero section. */
export function SiteHeader({ overlay = false }) {
  const { user } = useAuth();
  return (
    <header className={cn('z-20', overlay ? 'absolute top-0 inset-x-0' : 'border-b border-line')}>
      <div className="max-w-6xl mx-auto h-20 px-5 flex items-center justify-between gap-4">
        <Link to="/" aria-label="EventSphere home"><span className="sm:hidden"><Logo compact /></span><span className="hidden sm:inline"><Logo /></span></Link>
        <nav aria-label="Main" className="hidden md:flex items-center gap-1 mr-auto ml-6">
          {[['/', 'Home', true], ['/about', 'About', false], ['/help', 'Help', false]].map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('px-3 py-2 rounded-xl text-sm font-semibold transition', isActive ? 'text-primary-text bg-primary-soft' : 'text-muted hover:text-fg')}>{label}</NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user ? <Button to={ROLE_HOME[user.role]} className="ml-2">Open my portal</Button> : (
            <>
              <Button variant="ghost" to="/login" className="ml-1 max-sm:hidden">Sign in</Button>
              <Button to="/register" className="ml-1 sm:ml-0">Get started</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const SOCIAL_ICONS = { facebook: FaFacebookF, x: FaXTwitter, linkedin: FaLinkedinIn, instagram: FaInstagram, youtube: FaYoutube };

const FOOTER_COLUMNS = [
  { title: 'Platform', links: [['For organizers', '/login', 'admin'], ['For exhibitors', '/login', 'exhibitor'], ['For attendees', '/login', 'attendee'], ['Create an account', '/register']] },
  { title: 'Resources', links: [['Help Center', '/help'], ['Get started', '/register'], ['Sign in', '/login']] },
  { title: 'Company', links: [['About EventSphere', '/about'], ['Privacy Policy', '/privacy'], ['Terms of Service', '/terms']] },
];

export function PublicFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-line/60 bg-gradient-to-b from-transparent to-primary/[0.06] dark:to-black/30 text-sm">
      <span className="absolute -right-32 -bottom-32 size-[26rem] rounded-full bg-primary/10 blur-3xl pointer-events-none" aria-hidden />
      <span className="absolute -left-40 top-10 size-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" aria-hidden />
      <div className="relative max-w-6xl mx-auto px-5 pt-14 pb-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr_1.3fr]">
          <div>
            <Link to="/" aria-label="EventSphere home" className="inline-block"><Logo /></Link>
            <p className="mt-4 text-muted max-w-xs leading-relaxed">{FOOTER_TAGLINE}</p>
            {SOCIAL_LINKS.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2.5" aria-label="Social media">
                {SOCIAL_LINKS.map((l) => {
                  const Icon = SOCIAL_ICONS[l.id];
                  return Icon && (
                    <li key={l.id}>
                      <a href={l.href} target="_blank" rel="noopener noreferrer" aria-label={`${l.label} (opens in a new tab)`} title={l.label}
                        className="size-10 grid place-items-center rounded-full border border-line bg-surface/60 text-muted transition hover:text-white hover:bg-primary hover:border-primary hover:-translate-y-0.5">
                        <Icon className="size-[18px]" aria-hidden />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-8">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="text-sm font-bold text-fg">{col.title}</h2>
                <ul className="mt-3 space-y-0.5">
                  {col.links.map(([label, to, role]) => (
                    <li key={label}><Link to={to} state={role ? { role } : undefined} className="inline-block py-1.5 text-muted hover:text-fg transition">{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="glass-card p-6 self-start">
            <h2 className="text-base font-bold">Ready to run your expo?</h2>
            <p className="mt-1.5 text-muted">Create a free account and explore EventSphere as an organizer, exhibitor or attendee.</p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Button to="/register" size="sm">Get started <ArrowRight className="size-4" aria-hidden /></Button>
              <Button to="/login" size="sm" variant="secondary">Sign in</Button>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-line/60 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 text-[13px] text-muted">
          <p>© {new Date().getFullYear()} EventSphere Management. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5">
            <Link to="/terms" className="inline-block py-1 hover:text-fg">Terms of Service</Link>
            <Link to="/privacy" className="inline-block py-1 hover:text-fg">Privacy Policy</Link>
            <Link to="/help" className="inline-block py-1 hover:text-fg">Help Center</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

/** Simple page frame (header + footer) for the public information pages. */
export default function PublicShell({ title, intro, children }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <a href="#content" className="skip-link">Skip to content</a>
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto h-16 px-5 flex items-center justify-between">
          <Link to="/" aria-label="EventSphere home"><span className="sm:hidden"><Logo compact /></span><span className="hidden sm:inline"><Logo /></span></Link>
          <div className="flex items-center gap-1"><ThemeToggle /><Button to="/login" size="sm" className="ml-2">Sign in</Button></div>
        </div>
      </header>
      <main id="content" tabIndex={-1} className="flex-1 max-w-3xl w-full mx-auto px-5 py-12 focus:outline-none">
        <h1 className="text-3xl sm:text-4xl font-extrabold">{title}</h1>
        {intro && <p className="text-muted mt-3 text-lg">{intro}</p>}
        <div className="mt-8 space-y-8">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}
