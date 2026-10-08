import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, MapPin, Store, Tag, Ticket, Users } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Modal, Skeleton, SkeletonCards, StatCard, StatusBadge, Tabs } from '../../components/ui/index.jsx';
import FloorPlan from '../../components/FloorPlan.jsx';
import { get } from '../../lib/api.js';
import { fmtDay, fmtRange, groupBy, localDay } from '../../lib/utils.js';
import { useLiveBooths, useReveal } from '../../hooks/index.js';
import BoothDetails from './BoothDetails.jsx';
import { ExpoBanner, venueLine } from './ExpoCard.jsx';
import ExhibitorCard from './ExhibitorCard.jsx';
import RegisterButton from './RegisterButton.jsx';
import SessionCard from './SessionCard.jsx';
import { expoBadgeProps, idsKey, useExpoDetail, useExpoSessions, useUrlParams } from './attendeeShared.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'exhibitors', label: 'Exhibitors' },
  { id: 'floor-plan', label: 'Floor plan' },
];

function Overview({ expo }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-bold">About this expo</h2>
        {expo.theme && <p className="text-primary-text font-semibold">{expo.theme}</p>}
        <p className="whitespace-pre-line text-muted leading-relaxed">{expo.description || 'The organizer has not added a description yet.'}</p>
      </Card>
      <Card className="p-6 space-y-5">
        <h2 className="text-lg font-bold">Details</h2>
        <ul className="space-y-4 text-sm">
          <li className="flex gap-3"><CalendarDays className="size-5 text-primary-text shrink-0" aria-hidden /><span><span className="block font-semibold">When</span>{fmtRange(expo.startDate, expo.endDate)}</span></li>
          <li className="flex gap-3"><MapPin className="size-5 text-primary-text shrink-0" aria-hidden /><span><span className="block font-semibold">Where</span>{venueLine(expo) || 'To be announced'}{expo.location?.address && <span className="block text-muted">{expo.location.address}</span>}</span></li>
          {expo.capacity > 0 && <li className="flex gap-3"><Users className="size-5 text-primary-text shrink-0" aria-hidden /><span><span className="block font-semibold">Capacity</span>{expo.capacity.toLocaleString()} attendees</span></li>}
          {expo.categories?.length > 0 && (
            <li className="flex gap-3"><Tag className="size-5 text-primary-text shrink-0" aria-hidden />
              <span><span className="block font-semibold">Categories</span><span className="flex flex-wrap gap-1.5 mt-1">{expo.categories.map((c) => <Badge key={c} tone="primary">{c}</Badge>)}</span></span>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function ScheduleTab({ expoId }) {
  const sessions = useExpoSessions(expoId);
  const items = sessions.data?.items || [];
  const days = Object.entries(groupBy(items, (s) => localDay(s.startTime))).sort(([a], [b]) => a.localeCompare(b));
  const ref = useReveal('[data-item]', [idsKey(items)]);
  if (sessions.isLoading) return <SkeletonCards n={3} className="h-40" />;
  if (sessions.isError) return <ErrorState error={sessions.error} onRetry={sessions.refetch} />;
  if (!items.length) return <Card><EmptyState icon={CalendarDays} title="Schedule coming soon" text="Sessions will show up here as soon as the organizer publishes them." /></Card>;
  return (
    <div ref={ref} className="space-y-8">
      {days.map(([day, list]) => (
        <section key={day} aria-label={fmtDay(list[0].startTime)} className="space-y-3">
          <h3 className="text-lg font-bold">{fmtDay(list[0].startTime)}</h3>
          {list.map((s) => <SessionCard key={s._id} session={s} compact />)}
        </section>
      ))}
      <Button to={`/attendee/schedule?expo=${expoId}`} variant="secondary" icon={CalendarDays}>Open the full schedule with filters</Button>
    </div>
  );
}

function ExhibitorsTab({ expoId }) {
  const query = useQuery({ queryKey: ['directory', { expo: expoId, limit: 8 }], queryFn: () => get('/exhibitors/directory', { expo: expoId, limit: 8 }) });
  const items = query.data?.items || [];
  const ref = useReveal('[data-item]', [idsKey(items)]);
  if (query.isLoading) return <SkeletonCards n={4} className="h-36" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  if (!items.length) return <Card><EmptyState icon={Store} title="No exhibitors yet" text="Confirmed exhibitors will be listed here." /></Card>;
  return (
    <div ref={ref} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((e) => <ExhibitorCard key={e._id} exhibitor={e} expoId={expoId} />)}</div>
      <Button to={`/attendee/exhibitors?expo=${expoId}`} variant="secondary" icon={Store}>Search all {query.data.pagination.total} exhibitors</Button>
    </div>
  );
}

function FloorPlanTab({ expoId }) {
  const plan = useLiveBooths(expoId);
  const [booth, setBooth] = useState(null);
  if (plan.isLoading) return <Skeleton className="h-96" />;
  if (plan.isError) return <ErrorState error={plan.error} onRetry={plan.refetch} />;
  if (!plan.data.booths.length) return <Card><EmptyState icon={MapPin} title="Floor plan not ready" text="The organizer has not laid out any booths yet." /></Card>;
  return (
    <Card className="p-4 sm:p-5">
      <FloorPlan mode="view" floorPlan={plan.data.floorPlan} booths={plan.data.booths} selectedId={booth?._id} onSelect={setBooth} showPrice={false} />
      <p className="text-sm text-muted mt-3">Select a booth to see who is exhibiting. <Link to={`/attendee/floor-plan?expo=${expoId}`} className="font-semibold text-primary-text hover:underline">Open the full floor plan viewer</Link></p>
      <Modal open={!!booth} onClose={() => setBooth(null)} title="Booth details"
        footer={booth && <Button variant="secondary" to={`/attendee/floor-plan?expo=${expoId}&booth=${booth._id}`}>Open in floor plan viewer</Button>}>
        {booth && <BoothDetails booth={booth} expoId={expoId} />}
      </Modal>
    </Card>
  );
}

export default function ExpoDetail() {
  const { id } = useParams();
  const [params, setParams] = useUrlParams();
  const { data: expo, isLoading, isError, error, refetch } = useExpoDetail(id);
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview';

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-72" /><Skeleton className="h-28" /></div>;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const stats = expo.stats || {};
  return (
    <>
      <Link to="/attendee/expos" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg mb-4"><ArrowLeft className="size-4" aria-hidden />All expos</Link>

      <section data-reveal aria-labelledby="expo-title" className="card overflow-hidden mb-6">
        <ExpoBanner expo={expo} className="h-44 sm:h-60" />
        <div className="p-5 sm:p-7 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge {...expoBadgeProps(expo)} /></div>
            <h1 id="expo-title" className="text-2xl sm:text-4xl font-extrabold">{expo.title}</h1>
            <p className="text-muted flex flex-wrap gap-x-5 gap-y-1">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden />{fmtRange(expo.startDate, expo.endDate)}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{venueLine(expo) || 'Venue to be announced'}</span>
            </p>
          </div>
          <RegisterButton expo={expo} />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <StatCard label="Exhibitors" value={stats.booked || 0} icon={Store} />
        <StatCard label="Booths" value={stats.booths || 0} icon={MapPin} tone="info" hint={`${stats.available || 0} still open`} />
        <StatCard label="Registered attendees" value={stats.attendees || 0} icon={Ticket} tone="success" />
      </div>

      <Tabs tabs={TABS} value={tab} onChange={(t) => setParams({ tab: t === 'overview' ? '' : t })} label="Expo sections" className="mb-6" />
      <div role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0} className="focus:outline-none">
        {tab === 'overview' && <Overview expo={expo} />}
        {tab === 'schedule' && <ScheduleTab expoId={id} />}
        {tab === 'exhibitors' && <ExhibitorsTab expoId={id} />}
        {tab === 'floor-plan' && <FloorPlanTab expoId={id} />}
      </div>
    </>
  );
}
