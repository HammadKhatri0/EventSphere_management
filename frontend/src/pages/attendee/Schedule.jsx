import { useMemo, useState } from 'react';
import { CalendarSearch } from 'lucide-react';
import { Button, Chips, EmptyState, ErrorState, PageHeader, SearchInput, Select, Skeleton, Tabs } from '../../components/ui/index.jsx';
import { fmtDateShort, fmtDay, fmtTime, groupBy, localDay } from '../../lib/utils.js';
import { useReveal } from '../../hooks/index.js';
import ExpoSelect from './ExpoSelect.jsx';
import SessionCard from './SessionCard.jsx';
import { idsKey, useExpoChoice, useExpoSessions, useMeta } from './attendeeShared.js';

const matches = (s, { type, topic, q }) => {
  if (type && s.type !== type) return false;
  if (topic && s.topic !== topic) return false;
  if (!q) return true;
  const hay = [s.title, s.description, s.topic, s.location, ...(s.speakers || []).map((p) => p.name)].join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
};

function Timeline({ sessions }) {
  const groups = Object.values(groupBy(sessions, (s) => new Date(s.startTime).getTime())).sort((a, b) => new Date(a[0].startTime) - new Date(b[0].startTime));
  const ref = useReveal('[data-item]', [idsKey(sessions)]);
  return (
    <ol ref={ref} className="space-y-6">
      {groups.map((list) => (
        <li key={list[0].startTime} className="grid gap-3 md:grid-cols-[110px_1fr]">
          <h3 className="text-sm font-extrabold text-primary-text md:pt-5 md:text-right md:sticky md:top-20 md:self-start">
            <time dateTime={list[0].startTime}>{fmtTime(list[0].startTime)}</time>
          </h3>
          <div className="space-y-3 md:border-l-2 md:border-line md:pl-5">
            {list.map((s) => <SessionCard key={s._id} session={s} />)}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function Schedule() {
  const { expos, expo, expoId, setExpoId, params, setParams, query: exposQuery } = useExpoChoice();
  const sessions = useExpoSessions(expoId);
  const meta = useMeta();
  const [q, setQ] = useState('');
  const type = params.get('type') || '';
  const topic = params.get('topic') || '';

  const all = useMemo(() => sessions.data?.items || [], [sessions.data]);
  const days = useMemo(() => [...new Set(all.map((s) => localDay(s.startTime)))].sort(), [all]);
  const requestedDay = params.get('day');
  const day = days.includes(requestedDay) ? requestedDay : days.find((d) => d >= localDay(new Date())) || days[0];
  const topics = useMemo(() => [...new Set(all.map((s) => s.topic).filter(Boolean))].sort(), [all]);
  const filtered = useMemo(() => all.filter((s) => matches(s, { type, topic, q: q.trim() })), [all, type, topic, q]);
  const dayTabs = days.map((d, i) => ({ id: d, label: `Day ${i + 1} · ${fmtDateShort(`${d}T12:00`)}`, count: filtered.filter((s) => localDay(s.startTime) === d).length }));
  const visible = filtered.filter((s) => localDay(s.startTime) === day);
  const filtering = !!(type || topic || q.trim());
  const reset = () => { setQ(''); setParams({ type: '', topic: '' }); };

  return (
    <>
      <PageHeader title="Event schedule" subtitle={expo ? `Sessions at ${expo.title}. Bookmark, register and set reminders.` : 'Browse keynotes, workshops, panels and more.'} />

      <section data-reveal aria-label="Schedule filters" className="card p-4 sm:p-5 mb-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <ExpoSelect expos={expos} value={expoId} onChange={setExpoId} />
          <div className="space-y-1.5">
            <label htmlFor="schedule-q" className="block text-sm font-semibold">Search sessions</label>
            <SearchInput id="schedule-q" value={q} onChange={setQ} placeholder="Title, speaker or room" aria-label="Search sessions" />
          </div>
          <Select label="Topic" value={topic} placeholder="All topics" onChange={(e) => setParams({ topic: e.target.value })} options={topics} disabled={!topics.length} />
        </div>
        <Chips label="Session type" options={[{ value: '', label: 'All types' }, ...(meta.data?.sessionTypes || []).map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))]}
          value={type} onChange={(v) => setParams({ type: v })} />
      </section>

      {exposQuery.isLoading || sessions.isLoading ? <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        : exposQuery.isError ? <ErrorState error={exposQuery.error} onRetry={exposQuery.refetch} />
        : sessions.isError ? <ErrorState error={sessions.error} onRetry={sessions.refetch} />
        : !expo ? <EmptyState icon={CalendarSearch} title="No expos available" text="There are no published expos to show a schedule for yet." />
        : !all.length ? <EmptyState icon={CalendarSearch} title="Schedule not published yet" text="Sessions for this expo will appear here soon." />
        : (
          <>
            <Tabs tabs={dayTabs} value={day} onChange={(d) => setParams({ day: d })} label="Event days" className="mb-5" />
            <p role="status" aria-live="polite" className="text-sm text-muted mb-4">{visible.length} {visible.length === 1 ? 'session' : 'sessions'} on {fmtDay(`${day}T12:00`)}{filtering ? ' matching your filters' : ''}</p>
            <div role="tabpanel" aria-labelledby={`tab-${day}`}>
              {visible.length ? <Timeline sessions={visible} />
                : <EmptyState icon={CalendarSearch} title="No sessions match" text="Try another day or clear your filters." action={filtering && <Button variant="secondary" onClick={reset}>Clear filters</Button>} />}
            </div>
          </>
        )}
    </>
  );
}
