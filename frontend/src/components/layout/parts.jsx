import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, LogOut, Moon, Settings, Sun, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import { get, patch, post } from '../../lib/api.js';
import { cn, timeAgo, ROLE_LABEL } from '../../lib/utils.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useSocketEvent } from '../../hooks/index.js';
import { Avatar, IconButton } from '../ui/index.jsx';

export function Logo({ className, compact }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-extrabold tracking-tight', className)}>
      <span className="size-9 rounded-xl bg-primary grid place-items-center text-white shadow-md shadow-primary/30" aria-hidden>
        <svg viewBox="0 0 32 32" className="size-6"><circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" /><ellipse cx="16" cy="16" rx="3.5" ry="8" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 16h16" stroke="currentColor" strokeWidth="2" /></svg>
      </span>
      {!compact && <span className="text-lg">Event<span className="text-primary-text">Sphere</span></span>}
    </span>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} icon={theme === 'dark' ? Sun : Moon} onClick={toggle} aria-pressed={theme === 'dark'} />;
}

/** Closes a popover on outside click / Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

export function NotificationBell({ allHref }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { open, setOpen, ref } = usePopover();
  const { data } = useQuery({ queryKey: ['notifications', 'latest'], queryFn: () => get('/notifications', { limit: 8 }), enabled: !!user, refetchInterval: 120_000 });
  const unread = data?.unreadCount || 0;

  useSocketEvent('notification:new', (n) => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    toast(n.title, { description: n.body, action: n.link ? { label: 'Open', onClick: () => nav(n.link) } : undefined });
  });
  const readAll = useMutation({ mutationFn: () => post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const readOne = useMutation({ mutationFn: (id) => patch(`/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });

  const go = (n) => {
    setOpen(false);
    if (!n.read) readOne.mutate(n._id);
    if (n.link) nav(n.link);
  };
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} aria-haspopup="true"
        className="relative size-10 grid place-items-center rounded-xl text-muted hover:text-fg hover:bg-surface-2 transition">
        <Bell className="size-5" aria-hidden />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 min-w-4.5 h-4.5 px-1 rounded-full bg-danger text-white text-[10px] font-bold grid place-items-center">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,380px)] card shadow-2xl z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="font-bold">Notifications</p>
            {unread > 0 && <button type="button" onClick={() => readAll.mutate()} className="text-xs font-semibold text-primary-text inline-flex items-center gap-1 hover:underline"><CheckCheck className="size-3.5" aria-hidden />Mark all read</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-line">
            {data?.items?.length ? data.items.map((n) => (
              <li key={n._id}>
                <button type="button" onClick={() => go(n)} className={cn('w-full text-left px-4 py-3 hover:bg-surface-2 flex gap-3', !n.read && 'bg-primary-soft/40')}>
                  <span className={cn('mt-1.5 size-2 rounded-full shrink-0', n.read ? 'bg-transparent' : 'bg-primary')} aria-hidden />
                  <span className="min-w-0"><span className="block text-sm font-semibold leading-snug">{n.title}</span>{n.body && <span className="block text-[13px] text-muted truncate">{n.body}</span>}<span className="block text-xs text-muted mt-0.5">{timeAgo(n.createdAt)}</span></span>
                </button>
              </li>
            )) : <li className="px-4 py-10 text-center text-sm text-muted">You’re all caught up</li>}
          </ul>
          <Link to={allHref} onClick={() => setOpen(false)} className="block text-center text-sm font-semibold text-primary-text py-3 border-t border-line hover:bg-surface-2">View all notifications</Link>
        </div>
      )}
    </div>
  );
}

export function UserMenu({ settingsHref }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Account menu" className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-surface-2 transition">
        <Avatar name={user?.name} src={user?.avatar} size="sm" />
        <span className="hidden md:block text-left leading-tight"><span className="block text-sm font-semibold max-w-32 truncate">{user?.name}</span><span className="block text-xs text-muted">{ROLE_LABEL[user?.role]}</span></span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 card shadow-2xl z-40 p-1.5">
          <div className="px-3 py-2.5 border-b border-line mb-1"><p className="text-sm font-semibold truncate">{user?.name}</p><p className="text-xs text-muted truncate">{user?.email}</p></div>
          <Link to={settingsHref} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-surface-2"><Settings className="size-4" aria-hidden />Account &amp; privacy</Link>
          <Link to={`${settingsHref}#profile`} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-surface-2"><UserCircle className="size-4" aria-hidden />My profile</Link>
          <button type="button" onClick={async () => { setOpen(false); await logout(); nav('/login'); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-danger-text hover:bg-danger-soft"><LogOut className="size-4" aria-hidden />Sign out</button>
        </div>
      )}
    </div>
  );
}
