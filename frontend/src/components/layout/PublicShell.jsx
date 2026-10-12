import { Link, NavLink } from 'react-router-dom';
import { Logo, ThemeToggle } from './parts.jsx';
import { Button } from '../ui/index.jsx';
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

export function PublicFooter() {
  return (
    <footer className="border-t border-line py-8 text-sm text-muted">
      <div className="max-w-6xl mx-auto px-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="flex items-center gap-4">
          <Link to="/" aria-label="EventSphere home"><Logo compact /></Link>
          <span className="h-5 w-px bg-line hidden sm:block" aria-hidden />
          <span>© {new Date().getFullYear()} EventSphere Management. All rights reserved.</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-0.5 font-medium">
          <Link to="/about" className="inline-block py-1.5 hover:text-fg">About</Link>
          <Link to="/privacy" className="inline-block py-1.5 hover:text-fg">Privacy Policy</Link>
          <Link to="/terms" className="inline-block py-1.5 hover:text-fg">Terms of Service</Link>
          <Link to="/help" className="inline-block py-1.5 hover:text-fg">Help Center</Link>
        </nav>
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
