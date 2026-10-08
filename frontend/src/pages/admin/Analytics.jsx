import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, CalendarCheck, Download, Eye, Handshake, Mic2, Percent, Radio, Store, Users } from 'lucide-react';
import { api, errorMessage, get } from '../../lib/api.js';
import { fmtDate, fmtMoney, fmtNumber, fmtTime } from '../../lib/utils.js';
import { useLiveBooths, useReveal, useSocketEvent } from '../../hooks/index.js';
import FloorPlan from '../../components/FloorPlan.jsx';
import { Badge, Button, Card, CardHeader, DataTable, ErrorState, PageLoader, ProgressBar, StatCard, StatusBadge } from '../../components/ui/index.jsx';
import { BarList, CHART_COLORS, Donut, LineChart } from '../../components/charts/index.jsx';
import { ExpoScope, useThrottledCallback } from './shared.jsx';

export default function Analytics() {
  return (
    <ExpoScope title="Analytics" subtitle="Registrations, engagement and booth traffic for the selected expo.">
      {(expo) => <Report key={expo._id} expo={expo} />}
    </ExpoScope>
  );
}

function Report({ expo }) {
  const qc = useQueryClient();
  const expoId = expo._id;
  const key = ['analytics', 'expo', expoId];
  const { data: a, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({ queryKey: key, queryFn: () => get(`/analytics/expos/${expoId}`), placeholderData: keepPreviousData });
  const booths = useLiveBooths(expoId);
  const [downloading, setDownloading] = useState(false);

  const refresh = useThrottledCallback(() => qc.invalidateQueries({ queryKey: key }), 3000);
  useSocketEvent('analytics:tick', (p) => { if (!p?.expoId || String(p.expoId) === expoId) refresh(); });

  const ref = useReveal('[data-reveal]', [!!a]);
  const heat = useMemo(() => Object.fromEntries((a?.boothTraffic.heat || []).map((h) => [h.boothId, h.visits])), [a]);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/analytics/expos/${expoId}/report.csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `eventsphere-report-${expo.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download the report'));
    } finally { setDownloading(false); }
  };

  if (isLoading) return <PageLoader label="Crunching the numbers…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const { totals: t, boothStatus: b, applications: app } = a;
  const received = app.pending + app.approved + app.rejected + app.withdrawn;
  const engagement = [['booth', 'Booth views', CHART_COLORS.primary], ['exhibitor', 'Exhibitor views', CHART_COLORS.success], ['expo', 'Expo views', CHART_COLORS.warning]]
    .map(([k, name, color]) => ({ name, color, points: a.engagementByDay.map((d) => ({ x: d.date, y: d[k] || 0 })) }));

  return (
    <div ref={ref}>
      <div data-reveal className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Badge tone="success" icon={Radio}>Live</Badge>
          <span aria-live="polite">Updated {fmtTime(dataUpdatedAt)}</span>
        </p>
        <Button variant="secondary" icon={Download} loading={downloading} onClick={download}>Download CSV report</Button>
      </div>

      <section aria-label="Key figures" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Attendees" value={t.attendees} icon={Users} tone="info" />
        <StatCard label="Exhibitors" value={t.exhibitors} icon={Store} hint="With approved applications" />
        <StatCard label="Booth occupancy" value={t.occupancy} icon={Percent} format={(n) => `${Math.round(n)}%`} hint={`${t.booths} booths in total`} />
        <StatCard label="Revenue" value={t.revenue} icon={Banknote} tone="success" format={fmtMoney} hint="Confirmed booths" />
        <StatCard label="Booth visits" value={t.boothVisits} icon={Eye} tone="warning" />
        <StatCard label="Session registrations" value={t.sessionRegistrations} icon={CalendarCheck} hint={`${t.sessionBookmarks} bookmarks`} />
        <StatCard label="Inquiries" value={t.inquiries} icon={Handshake} tone="info" hint={`${t.appointments} appointment requests`} />
        <StatCard label="Sessions" value={t.sessions} icon={Mic2} tone="danger" hint="On the schedule" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <Card data-reveal>
          <CardHeader title="Registrations over time" subtitle="New attendee registrations per day" />
          <div className="p-5"><LineChart series={[{ name: 'Registrations', color: CHART_COLORS.primary, points: a.registrationsByDay.map((r) => ({ x: r.date, y: r.count })) }]} /></div>
        </Card>
        <Card data-reveal>
          <CardHeader title="Engagement by day" subtitle="Last 30 days of views" />
          <div className="p-5"><LineChart series={engagement} area={false} /></div>
        </Card>

        <Card data-reveal>
          <CardHeader title="Booth occupancy" />
          <div className="p-5">
            <Donut centerLabel="booths" segments={[
              { label: 'Available', value: b.available, color: CHART_COLORS.success },
              { label: 'Pending approval', value: b.reserved, color: CHART_COLORS.warning },
              { label: 'Confirmed', value: b.booked, color: CHART_COLORS.danger },
              { label: 'Blocked', value: b.blocked, color: CHART_COLORS.muted },
            ]} />
          </div>
        </Card>
        <Card data-reveal>
          <CardHeader title="Application funnel" subtitle={`${received} applications received`} />
          <div className="p-5">
            <BarList max={Math.max(1, received)} data={[
              { label: 'Received', value: received, color: CHART_COLORS.primary },
              { label: 'Approved', value: app.approved, color: CHART_COLORS.success },
              { label: 'Pending review', value: app.pending, color: CHART_COLORS.warning },
              { label: 'Rejected', value: app.rejected, color: CHART_COLORS.danger },
              { label: 'Withdrawn', value: app.withdrawn, color: CHART_COLORS.muted },
            ]} />
          </div>
        </Card>

        <Card data-reveal>
          <CardHeader title="Exhibitor categories" subtitle="Approved exhibitors by industry" />
          <div className="p-5"><BarList empty="No approved exhibitors yet" data={a.categories.map((c) => ({ label: c.name, value: c.count }))} /></div>
        </Card>
        <Card data-reveal>
          <CardHeader title="Session popularity" subtitle="Registrations and bookmarks against capacity" />
          <DataTable caption="Most popular sessions" rows={a.sessionPopularity}
            empty={<p className="text-sm text-muted text-center py-10">No sessions yet</p>}
            columns={[
              { key: 'title', header: 'Session', render: (s) => <span className="font-semibold">{s.title}</span> },
              { key: 'registered', header: 'Registered', render: (s) => (
                <div className="min-w-28">
                  <p className="tabular-nums">{s.registered}{s.capacity > 0 ? ` / ${s.capacity}` : ' · no limit'}</p>
                  {s.capacity > 0 && <ProgressBar value={(s.registered / s.capacity) * 100} label={`${s.title} registrations`} />}
                </div>
              ) },
              { key: 'bookmarked', header: 'Saved', align: 'right', render: (s) => <span className="tabular-nums">{fmtNumber(s.bookmarked)}</span> },
            ]} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] mt-6">
        <Card data-reveal className="p-5">
          <h2 className="text-base font-bold">Booth traffic heatmap</h2>
          <p className="text-sm text-muted mt-0.5 mb-4">Darker booths receive more visits. Total: {fmtNumber(t.boothVisits)} visits.</p>
          {booths.isLoading ? <PageLoader label="Loading floor plan…" /> : booths.isError ? <ErrorState error={booths.error} onRetry={booths.refetch} /> : (
            <FloorPlan mode="heatmap" floorPlan={booths.data.floorPlan} booths={booths.data.booths} heat={heat} maxHeat={a.boothTraffic.maxVisits} label={`Booth traffic heatmap for ${expo.title}`} />
          )}
        </Card>
        <Card data-reveal>
          <CardHeader title="Busiest booths" subtitle="Top 8 by visits" />
          <ol className="p-5 space-y-3">
            {a.boothTraffic.top.map((h, i) => (
              <li key={h.boothId} className="flex items-center gap-3">
                <span className="size-7 rounded-lg bg-surface-2 grid place-items-center text-sm font-bold tabular-nums">{i + 1}</span>
                <span className="font-semibold whitespace-nowrap">Booth {h.code}</span>
                <StatusBadge status={h.status} className="hidden sm:inline-flex" />
                <span className="ml-auto tabular-nums text-sm whitespace-nowrap"><span className="font-bold">{fmtNumber(h.visits)}</span> <span className="text-muted">visits</span></span>
              </li>
            ))}
            {!a.boothTraffic.top.length && <li className="text-sm text-muted text-center py-6">No booths yet</li>}
          </ol>
        </Card>
      </div>
      <p className="mt-6 text-[13px] text-muted">Report period: {fmtDate(a.expo.startDate)} to {fmtDate(a.expo.endDate)}</p>
    </div>
  );
}
