import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, CalendarDays, CheckCircle2, Circle, Eye, Handshake, LifeBuoy, Map, MessageCircle, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, ProgressBar, StatCard, StatusBadge } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { get } from '../../lib/api.js';
import { fmtDate } from '../../lib/utils.js';
import { KEYS, useMyProfile, usePageReveal, useSocketEvents } from './shared.js';

const REFRESH_EVENTS = ['notification:new', 'inquiry:updated', 'message:new', 'ticket:updated'];

const CHECKLIST = [
  ['Company name', (p) => p.companyName],
  ['Company logo', (p) => p.logo],
  ['Company description', (p) => p.description],
  ['At least one product or service', (p) => p.products?.length],
  ['A brochure or document', (p) => p.documents?.length],
  ['A staff contact', (p) => p.staff?.length],
];

const sum = (counts, keys) => keys.reduce((n, k) => n + (counts?.[k] || 0), 0);

/** Decides the single most useful next step for an expo the exhibitor has an application for. */
function nextStep(application, booth) {
  if (application.status === 'rejected' || application.status === 'withdrawn') return { label: 'Apply again', to: '/exhibitor/expos' };
  if (application.status === 'pending') return { label: 'View application', to: '/exhibitor/applications', variant: 'secondary' };
  if (!booth) return { label: 'Reserve a booth', to: `/exhibitor/booths?expo=${application.expo._id}` };
  return { label: 'Manage booth', to: '/exhibitor/booths', variant: 'secondary' };
}

function ParticipationCard({ application, booth }) {
  const step = nextStep(application, booth);
  return (
    <Card data-reveal className="p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold truncate">{application.expo.title}</h3>
          <p className="text-sm text-muted flex items-center gap-1.5 mt-0.5"><CalendarDays className="size-4" aria-hidden />Starts {fmtDate(application.expo.startDate)}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>
      <div className="rounded-xl bg-surface-2 p-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted font-semibold">Booth</p>
          {booth ? <p className="font-bold text-lg leading-tight">{booth.code}<span className="text-sm font-medium text-muted"> · {booth.zone || booth.size}</span></p>
            : <p className="text-sm text-muted">{application.status === 'approved' ? 'Not reserved yet' : 'Available after approval'}</p>}
        </div>
        {booth && <StatusBadge status={booth.status} />}
      </div>
      <Button to={step.to} variant={step.variant || 'primary'} className="mt-auto" icon={ArrowRight}>{step.label}</Button>
    </Card>
  );
}

function ProfileChecklist({ completeness, profile }) {
  return (
    <Card data-reveal className="p-5 lg:col-span-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold flex items-center gap-2"><Building2 className="size-5 text-primary" aria-hidden />Profile completeness</h2>
        <span className="text-2xl font-extrabold tabular-nums">{completeness}%</span>
      </div>
      <div className="mt-3"><ProgressBar value={completeness} tone={completeness >= 80 ? 'success' : 'primary'} label="Profile completeness" /></div>
      {profile ? (
        <ul className="mt-4 space-y-2 text-sm">
          {CHECKLIST.map(([label, done]) => {
            const ok = !!done(profile);
            return (
              <li key={label} className="flex items-center gap-2">
                {ok ? <CheckCircle2 className="size-4 text-success shrink-0" aria-hidden /> : <Circle className="size-4 text-muted shrink-0" aria-hidden />}
                <span className={ok ? 'text-muted line-through' : 'font-medium'}>{label}</span>
                <span className="sr-only">{ok ? '(done)' : '(to do)'}</span>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-4 text-sm text-muted">Create your company profile so organizers and visitors can find you.</p>}
      <Button to="/exhibitor/profile" variant={completeness >= 100 ? 'secondary' : 'primary'} className="mt-5 w-full" icon={ArrowRight}>
        {completeness >= 100 ? 'Review profile' : 'Complete your profile'}
      </Button>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: KEYS.dashboard, queryFn: () => get('/exhibitors/dashboard') });
  const { data: profile } = useMyProfile();
  const ref = usePageReveal(data);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: KEYS.dashboard });
    qc.invalidateQueries({ queryKey: KEYS.myBooths });
  };
  useSocketEvents(REFRESH_EVENTS, refresh);

  const firstName = user?.name?.split(' ')[0];
  const header = <PageHeader title={`${data?.applications?.length ? 'Welcome back' : 'Welcome'}${firstName ? `, ${firstName}` : ''}`} subtitle="Track your expo participation, booths and conversations in one place." actions={<Button to="/exhibitor/expos" icon={Ticket}>Find expos</Button>} />;

  if (isLoading) return <>{header}<PageLoader /></>;
  if (error) return <>{header}<ErrorState error={error} onRetry={refetch} /></>;

  const boothFor = (app) => data.booths.find((b) => b.expo._id === app.expo._id);
  const openInquiries = data.inquiries?.pending || 0;
  const openTickets = sum(data.tickets, ['open', 'in_progress']);

  return (
    <div ref={ref}>
      {header}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Booth visits" value={data.boothVisits} icon={Eye} tone="info" hint="Across all your booths" />
        <StatCard label="Open inquiries" value={openInquiries} icon={Handshake} tone="warning" hint="Awaiting your reply" to="/exhibitor/inquiries" />
        <StatCard label="Unread messages" value={data.unreadMessages} icon={MessageCircle} tone="primary" hint="From other exhibitors" to="/exhibitor/messages" />
        <StatCard label="Open tickets" value={openTickets} icon={LifeBuoy} tone="success" hint="With the organizers" to="/exhibitor/support" />
      </div>

      <div className="grid gap-6 mt-6 lg:grid-cols-3">
        <ProfileChecklist completeness={data.profileCompleteness} profile={profile} />

        <section className="lg:col-span-2" aria-labelledby="participation-title">
          <div className="flex items-center justify-between mb-3">
            <h2 id="participation-title" className="text-base font-bold">Your participation</h2>
            <Link to="/exhibitor/applications" className="text-sm font-semibold text-primary-text hover:underline">All applications</Link>
          </div>
          {data.applications.length === 0 ? (
            <Card data-reveal>
              <EmptyState icon={Map} title="You haven't applied to an expo yet" text="Browse upcoming expos, apply to exhibit and reserve your booth once approved."
                action={<Button to="/exhibitor/expos" icon={Ticket}>Browse expos</Button>} />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.applications.map((app) => <ParticipationCard key={app._id} application={app} booth={boothFor(app)} />)}
            </div>
          )}
          {data.booths.length > 0 && (
            <p className="text-sm text-muted mt-4 flex items-center gap-2">
              <Badge tone="primary">{data.booths.length}</Badge>
              {data.booths.length === 1 ? 'booth' : 'booths'} held across your expos. <Link to="/exhibitor/booths" className="font-semibold text-primary-text hover:underline">Manage booths</Link>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
