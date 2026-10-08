import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, CalendarPlus, CheckCircle2, ClipboardCheck, LifeBuoy, Map, Percent, Radio, Ticket, Users } from 'lucide-react';
import { get, patch, errorMessage } from '../../lib/api.js';
import { fmtMoney, timeAgo } from '../../lib/utils.js';
import { useReveal, useSocketEvent } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from '../../components/ui/index.jsx';
import { BarList, CHART_COLORS, Donut, LineChart } from '../../components/charts/index.jsx';
import { ExpoSelect, useSelectedExpo, useThrottledCallback } from './shared.jsx';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const QUICK_ACTIONS = [
  { to: '/admin/expos/new', icon: CalendarPlus, label: 'Create an expo', text: 'Set dates, venue and floor plan size' },
  { to: '/admin/applications', icon: ClipboardCheck, label: 'Review applications', text: 'Approve exhibitors waiting in the queue' },
  { to: '/admin/floor-plan', icon: Map, label: 'Manage floor plan', text: 'Place booths and confirm reservations' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sel = useSelectedExpo();

  const overview = useQuery({ queryKey: ['analytics', 'overview'], queryFn: () => get('/analytics/overview') });
  const pending = useQuery({
    queryKey: ['applications', 'dashboard-pending'],
    queryFn: () => get('/applications', { status: 'pending', limit: 5 }),
    placeholderData: keepPreviousData,
  });
  const analytics = useQuery({
    queryKey: ['analytics', 'expo', sel.expoId],
    queryFn: () => get(`/analytics/expos/${sel.expoId}`),
    enabled: !!sel.expoId,
    placeholderData: keepPreviousData,
  });

  const refresh = useThrottledCallback(() => {
    qc.invalidateQueries({ queryKey: ['analytics'] });
    qc.invalidateQueries({ queryKey: ['applications'] });
  }, 3000);
  useSocketEvent('application:new', refresh);
  useSocketEvent('analytics:tick', refresh);
  useSocketEvent('ticket:new', () => qc.invalidateQueries({ queryKey: ['analytics', 'overview'] }));

  const approve = useMutation({
    mutationFn: (id) => patch(`/applications/${id}/review`, { status: 'approved' }),
    onSuccess: () => {
      toast.success('Application approved');
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const statsRef = useReveal('[data-reveal]', [!!overview.data]);
  const o = overview.data;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(' ')[0] || 'organizer'}`}
        subtitle="Here is what is happening across your expos right now."
        actions={<Button to="/admin/expos/new" icon={CalendarPlus}>New expo</Button>}
      />

      {overview.isError ? <ErrorState error={overview.error} onRetry={overview.refetch} /> : (
        <section ref={statsRef} aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {!o ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32" />) : (
            <>
              <StatCard label="Active expos" value={o.activeExpos} icon={Ticket} hint={`${o.expos} expos in total`} to="/admin/expos" />
              <StatCard label="Registered attendees" value={o.attendees} icon={Users} tone="info" />
              <StatCard label="Pending applications" value={o.pendingApplications} icon={ClipboardCheck} tone="warning" hint="Waiting for your review" to="/admin/applications" />
              <StatCard label="Open tickets" value={o.openTickets} icon={LifeBuoy} tone="danger" hint="Open or in progress" to="/admin/support" />
              <StatCard label="Booth revenue" value={o.revenue} icon={Banknote} tone="success" format={fmtMoney} hint={`${o.bookedBooths} confirmed booths`} />
              <StatCard label="Booth occupancy" value={o.occupancy} icon={Percent} format={(n) => `${Math.round(n)}%`} hint="Reserved and confirmed" />
            </>
          )}
        </section>
      )}

      <section aria-label="Quick actions" className="grid gap-4 sm:grid-cols-3 mt-6">
        {QUICK_ACTIONS.map(({ to, icon: Icon, label, text }) => (
          <Link key={to} to={to} data-reveal className="card p-4 flex items-center gap-3 transition hover:-translate-y-0.5 hover:border-primary">
            <span className="size-11 rounded-xl bg-primary-soft text-primary-text grid place-items-center shrink-0"><Icon className="size-5" aria-hidden /></span>
            <span className="min-w-0"><span className="block font-bold">{label}</span><span className="block text-sm text-muted">{text}</span></span>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-5 mt-6">
        <Card className="lg:col-span-2" data-reveal>
          <CardHeader title="Pending applications" subtitle="Newest first"
            actions={<Button to="/admin/applications" variant="ghost" size="sm">View all</Button>} />
          <div className="p-5">
            {pending.isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
              : pending.isError ? <ErrorState error={pending.error} onRetry={pending.refetch} />
                : !pending.data.items.length ? <EmptyState icon={CheckCircle2} title="All caught up" text="No applications are waiting for review." className="py-8" />
                  : (
                    <ul className="divide-y divide-line">
                      {pending.data.items.map((a) => (
                        <li key={a._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                          <Avatar name={a.profile?.companyName} src={a.profile?.logo} />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{a.profile?.companyName || 'Unknown company'}</p>
                            <p className="text-[13px] text-muted truncate">{a.expo?.title} · {timeAgo(a.createdAt)}</p>
                          </div>
                          <Button size="sm" variant="success" loading={approve.isPending && approve.variables === a._id}
                            aria-label={`Approve ${a.profile?.companyName || 'application'}`} onClick={() => approve.mutate(a._id)}>Approve</Button>
                        </li>
                      ))}
                    </ul>
                  )}
          </div>
        </Card>

        <Card className="lg:col-span-3" data-reveal>
          <CardHeader title="Live expo analytics" subtitle="Updates in real time as visitors and exhibitors act"
            actions={<Badge tone="success" icon={Radio}>Live</Badge>} />
          <div className="p-5">
            {sel.isLoading ? <Skeleton className="h-64" /> : !sel.expos.length ? <EmptyState icon={Ticket} title="No expos yet" text="Create an expo to see live analytics here." className="py-8" /> : (
              <>
                <ExpoSelect expos={sel.expos} value={sel.expoId} onChange={sel.setExpoId} className="max-w-sm mb-5" />
                {analytics.isLoading ? <Skeleton className="h-64" /> : analytics.isError ? <ErrorState error={analytics.error} onRetry={analytics.refetch} /> : <ExpoSummary a={analytics.data} />}
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function ExpoSummary({ a }) {
  const b = a.boothStatus;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="xl:col-span-2">
        <h3 className="text-sm font-bold mb-2">Registrations over time</h3>
        <LineChart series={[{ name: 'Registrations', color: CHART_COLORS.primary, points: a.registrationsByDay.map((r) => ({ x: r.date, y: r.count })) }]} height={200} />
      </div>
      <div>
        <h3 className="text-sm font-bold mb-3">Booth status</h3>
        <Donut centerLabel="booths" size={140} segments={[
          { label: 'Available', value: b.available, color: CHART_COLORS.success },
          { label: 'Pending approval', value: b.reserved, color: CHART_COLORS.warning },
          { label: 'Confirmed', value: b.booked, color: CHART_COLORS.danger },
          { label: 'Blocked', value: b.blocked, color: CHART_COLORS.muted },
        ]} />
      </div>
      <div>
        <h3 className="text-sm font-bold mb-3">Most popular sessions</h3>
        <BarList empty="No session activity yet" data={a.sessionPopularity.slice(0, 5).map((s) => ({
          label: s.title, value: s.registered + s.bookmarked, display: `${s.registered} registered · ${s.bookmarked} saved`,
        }))} />
      </div>
    </div>
  );
}
