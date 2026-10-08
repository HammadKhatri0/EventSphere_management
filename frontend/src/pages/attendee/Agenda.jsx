import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus, Download, Ticket } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge, Tabs } from '../../components/ui/index.jsx';
import { get } from '../../lib/api.js';
import { fmtDay, fmtRange, groupBy, localDay } from '../../lib/utils.js';
import { useExpoRoom, useReveal, useSocketEvent } from '../../hooks/index.js';
import { downloadIcs } from './calendar.js';
import { venueLine } from './ExpoCard.jsx';
import SessionCard from './SessionCard.jsx';
import { expoBadgeProps, idsKey, useMyRegistrations, useUrlParams } from './attendeeShared.js';

const FILTERS = { all: () => true, registered: (s) => s.my.kind === 'registered', bookmarked: (s) => s.my.kind === 'bookmark' };

function DayList({ sessions }) {
  const days = Object.entries(groupBy(sessions, (s) => localDay(s.startTime))).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="space-y-8">
      {days.map(([day, list]) => (
        <section key={day} aria-label={fmtDay(list[0].startTime)} className="space-y-3">
          <h3 className="text-lg font-bold">{fmtDay(list[0].startTime)}</h3>
          {list.map((s) => (
            <SessionCard key={s._id} session={s} showExpo
              extra={<Button size="sm" variant="ghost" icon={CalendarPlus} onClick={() => downloadIcs(s, s.title.replace(/\W+/g, '-').toLowerCase())}>Add to calendar</Button>} />
          ))}
        </section>
      ))}
    </div>
  );
}

/** Keeps one expo room joined so `schedule:updated` reaches the agenda. */
function ExpoRoom({ expoId }) {
  useExpoRoom(expoId);
  return null;
}

function Registrations() {
  const regs = useMyRegistrations();
  const ref = useReveal('[data-item]', [idsKey(regs.data)]);
  if (regs.isLoading) return <Skeleton className="h-28" />;
  if (regs.isError) return <ErrorState error={regs.error} onRetry={regs.refetch} />;
  if (!regs.data.length) return null;
  return (
    <section ref={ref} aria-labelledby="my-expos" className="mt-12">
      <h2 id="my-expos" className="text-xl font-bold mb-4">My expo registrations</h2>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {regs.data.map((e) => (
          <li key={e._id} data-item className="card relative p-5 space-y-2 transition hover:-translate-y-0.5">
            <StatusBadge {...expoBadgeProps(e)} />
            <h3 className="font-bold leading-snug"><Link to={`/attendee/expos/${e._id}`} className="after:absolute after:inset-0 after:content-['']">{e.title}</Link></h3>
            <p className="text-sm text-muted">{fmtRange(e.startDate, e.endDate)}</p>
            <p className="text-sm text-muted">{venueLine(e)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Agenda() {
  const qc = useQueryClient();
  const [params, setParams] = useUrlParams();
  const agenda = useQuery({ queryKey: ['agenda'], queryFn: () => get('/sessions/mine') });
  useSocketEvent('schedule:updated', () => qc.invalidateQueries({ queryKey: ['agenda'] }));
  const tab = FILTERS[params.get('tab')] ? params.get('tab') : 'all';

  // optimistic removals briefly leave `my: null` in the cache
  const all = useMemo(() => (agenda.data?.items || []).filter((s) => s.my), [agenda.data]);
  const counts = { all: all.length, registered: all.filter(FILTERS.registered).length, bookmarked: all.filter(FILTERS.bookmarked).length };
  const tabs = [{ id: 'all', label: 'All' }, { id: 'registered', label: 'Registered' }, { id: 'bookmarked', label: 'Bookmarked' }].map((t) => ({ ...t, count: counts[t.id] }));
  const shown = all.filter(FILTERS[tab]);
  const now = Date.now();
  const upcoming = shown.filter((s) => new Date(s.endTime).getTime() >= now);
  const past = shown.filter((s) => new Date(s.endTime).getTime() < now);
  const ref = useReveal('[data-item]', [idsKey(shown)]);
  const expoIds = [...new Set(all.map((s) => s.expo?._id).filter(Boolean))];

  return (
    <>
      {expoIds.map((id) => <ExpoRoom key={id} expoId={id} />)}
      <PageHeader title="My agenda" subtitle="Your registered and bookmarked sessions, with reminders."
        actions={upcoming.length > 0 && <Button variant="secondary" icon={Download} onClick={() => downloadIcs(upcoming)}>Export upcoming (.ics)</Button>} />

      {agenda.isLoading ? <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        : agenda.isError ? <ErrorState error={agenda.error} onRetry={agenda.refetch} />
        : !all.length ? (
          <Card><EmptyState icon={CalendarDays} title="Your agenda is empty" text="Bookmark sessions you are curious about and register for the ones you will attend."
            action={<Button to="/attendee/schedule" icon={Ticket}>Browse the schedule</Button>} /></Card>
        ) : (
          <>
            <Tabs tabs={tabs} value={tab} onChange={(t) => setParams({ tab: t === 'all' ? '' : t })} label="Agenda filter" className="mb-6" />
            <div ref={ref} role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-10">
              {shown.length === 0 && <EmptyState icon={CalendarDays} title={`No ${tab} sessions`} text="Sessions you add from the schedule will show up here." action={<Button to="/attendee/schedule" variant="secondary">Browse the schedule</Button>} />}
              {upcoming.length > 0 && <section aria-labelledby="agenda-upcoming"><h2 id="agenda-upcoming" className="sr-only">Upcoming sessions</h2><DayList sessions={upcoming} /></section>}
              {past.length > 0 && (
                <details>
                  <summary className="cursor-pointer select-none text-sm font-bold flex items-center gap-2 mb-4">Past sessions <Badge>{past.length}</Badge></summary>
                  <DayList sessions={past} />
                </details>
              )}
            </div>
          </>
        )}

      <Registrations />
    </>
  );
}
