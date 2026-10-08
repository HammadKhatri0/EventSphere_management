import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BellRing, Bookmark, BookmarkCheck, CheckCircle2, Clock, MapPin, Mic2, Ticket, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, ProgressBar } from '../../components/ui/index.jsx';
import { del, errorMessage, post } from '../../lib/api.js';
import { cn, fmtDate, fmtTime } from '../../lib/utils.js';
import { DEFAULT_REMINDER, reminderLabel, useMeta } from './attendeeShared.js';

const TYPE_TONE = { keynote: 'primary', talk: 'info', workshop: 'success', panel: 'warning', networking: 'neutral' };
const FALLBACK_REMINDERS = [5, 10, 15, 30, 60, 120, 1440];

const mapItems = (old, id, fn) => (old?.items ? { ...old, items: old.items.map((s) => (s._id === id ? fn(s) : s)) } : old);

/** Optimistic projection of an agenda action onto a session. */
const project = (s, action, minutes) => {
  const kind = s.my?.kind;
  const reminderMinutes = minutes ?? s.my?.reminderMinutes ?? DEFAULT_REMINDER;
  const seats = (d) => ({ registeredCount: Math.max(0, (s.registeredCount || 0) + d) });
  switch (action) {
    case 'bookmark': return { ...s, my: { kind: 'bookmark', reminderMinutes } };
    case 'register': return { ...s, ...(kind === 'registered' ? {} : seats(1)), my: { kind: 'registered', reminderMinutes } };
    case 'unregister': return { ...s, ...seats(-1), my: { kind: 'bookmark', reminderMinutes } };
    case 'remove': return { ...s, ...(kind === 'registered' ? seats(-1) : {}), my: null };
    default: return { ...s, my: s.my && { ...s.my, reminderMinutes } };
  }
};

const CALLS = {
  bookmark: (id, minutes) => post(`/sessions/${id}/bookmark`, { reminderMinutes: minutes }),
  register: (id, minutes) => post(`/sessions/${id}/register`, { reminderMinutes: minutes }),
  unregister: (id) => post(`/sessions/${id}/unregister`),
  remove: (id) => del(`/sessions/${id}/mine`),
  // The bookmark endpoint keeps an existing reminder, so a bookmark is re-created to change it.
  reminder: async (id, minutes, kind) => {
    if (kind === 'registered') return post(`/sessions/${id}/register`, { reminderMinutes: minutes });
    await del(`/sessions/${id}/mine`);
    return post(`/sessions/${id}/bookmark`, { reminderMinutes: minutes });
  },
};

const SUCCESS = {
  bookmark: 'Saved to your agenda',
  register: 'You are registered for this session',
  unregister: 'Registration cancelled. The session stays bookmarked.',
  remove: 'Removed from your agenda',
  reminder: 'Reminder updated',
};

/** Bookmark / register / reminder actions for one session, with optimistic cache updates. */
export function useSessionActions(session) {
  const qc = useQueryClient();
  const patch = (fn) => ['sessions', 'agenda'].forEach((key) => qc.setQueriesData({ queryKey: [key] }, (old) => mapItems(old, session._id, fn)));
  const mutation = useMutation({
    mutationFn: ({ action, minutes }) => CALLS[action](session._id, minutes, session.my?.kind),
    onMutate: async ({ action, minutes }) => {
      await Promise.all(['sessions', 'agenda'].map((key) => qc.cancelQueries({ queryKey: [key] })));
      patch((s) => project(s, action, minutes));
    },
    onSuccess: (res, { action }) => {
      const warning = res?.data?.warning;
      if (warning) toast.warning(warning);
      else toast.success(SUCCESS[action]);
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => ['sessions', 'agenda'].forEach((key) => qc.invalidateQueries({ queryKey: [key] })),
  });
  return { run: (action, minutes) => mutation.mutate({ action, minutes }), pending: mutation.isPending };
}

function SeatsInfo({ session }) {
  if (!session.capacity) return <span className="inline-flex items-center gap-1.5 text-[13px] text-muted"><Users className="size-4" aria-hidden />Open seating</span>;
  const left = Math.max(0, session.capacity - session.registeredCount);
  const pct = (session.registeredCount / session.capacity) * 100;
  const tone = left === 0 ? 'danger' : left <= Math.max(3, session.capacity * 0.2) ? 'warning' : 'success';
  return (
    <div className="flex items-center gap-3 min-w-0 w-full max-w-xs">
      <div className="flex-1"><ProgressBar value={pct} tone={tone} label={`${session.registeredCount} of ${session.capacity} seats taken`} /></div>
      <Badge tone={tone} icon={Users}>{left === 0 ? 'Full' : `${left} ${left === 1 ? 'seat' : 'seats'} left`}</Badge>
    </div>
  );
}

function ReminderSelect({ value, options, disabled, onChange }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <BellRing className="size-4" aria-hidden />
      <span>Remind me</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-fg focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60">
        {options.map((m) => <option key={m} value={m}>{reminderLabel(m)}</option>)}
      </select>
    </label>
  );
}

/**
 * One schedule entry with its agenda actions. `extra` renders additional action buttons;
 * `compact` hides the description and seat meter (used in previews).
 */
export default function SessionCard({ session, compact = false, showExpo = false, extra }) {
  const { run, pending } = useSessionActions(session);
  const { data: meta } = useMeta();
  const reminders = meta?.reminderOptions || FALLBACK_REMINDERS;
  const kind = session.my?.kind;
  const ended = new Date(session.endTime).getTime() < Date.now();
  const full = session.capacity > 0 && session.registeredCount >= session.capacity;
  const speakers = (session.speakers || []).map((p) => p.name).join(', ');

  return (
    <article data-item className={cn('card p-4 sm:p-5 space-y-3', ended && 'opacity-80')} aria-label={session.title}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TYPE_TONE[session.type] || 'neutral'} className="capitalize">{session.type}</Badge>
          {session.topic && <Badge>{session.topic}</Badge>}
          {ended && <Badge>Ended</Badge>}
          {kind === 'registered' && <Badge tone="success" icon={CheckCircle2}>Registered</Badge>}
          {kind === 'bookmark' && <Badge tone="primary" icon={BookmarkCheck}>Bookmarked</Badge>}
        </div>
        <h3 className="text-base font-bold leading-snug">{session.title}</h3>
        {showExpo && session.expo?.title && <p className="text-[13px] text-muted">{session.expo.title}</p>}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
        <li className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden />
          <time dateTime={session.startTime}>{fmtDate(session.startTime)}, {fmtTime(session.startTime)}</time> – <time dateTime={session.endTime}>{fmtTime(session.endTime)}</time>
        </li>
        <li className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{session.location}</li>
        {speakers && <li className="flex items-center gap-1.5 min-w-0"><Mic2 className="size-4 shrink-0" aria-hidden /><span className="truncate">{speakers}</span></li>}
      </ul>

      {!compact && session.description && <p className="text-sm text-muted line-clamp-2">{session.description}</p>}
      {!compact && <SeatsInfo session={session} />}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {kind === 'registered' ? (
          <Button size="sm" variant="secondary" icon={X} loading={pending} onClick={() => run('unregister')}>Cancel registration</Button>
        ) : (
          <>
            <Button size="sm" variant={kind === 'bookmark' ? 'soft' : 'secondary'} icon={kind === 'bookmark' ? BookmarkCheck : Bookmark} disabled={pending}
              aria-pressed={kind === 'bookmark'} onClick={() => run(kind === 'bookmark' ? 'remove' : 'bookmark')}>
              {kind === 'bookmark' ? 'Bookmarked' : 'Bookmark'}
            </Button>
            <Button size="sm" icon={Ticket} disabled={pending || ended || full} onClick={() => run('register')}>{full ? 'Session full' : 'Register'}</Button>
          </>
        )}
        {kind === 'registered' && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run('remove')}>Remove</Button>}
        {extra}
        {kind && !ended && (
          <div className="ml-auto">
            <ReminderSelect value={session.my.reminderMinutes ?? DEFAULT_REMINDER} options={reminders} disabled={pending} onChange={(m) => run('reminder', m)} />
          </div>
        )}
      </div>
    </article>
  );
}
