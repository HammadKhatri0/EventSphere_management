import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, CheckCircle2, Circle, ClipboardCheck, Clock, ExternalLink, MapPin, Store, Ticket, Undo2, XCircle } from 'lucide-react';
import { Alert, Button, Card, Chips, ConfirmModal, EmptyState, ErrorState, PageHeader, SkeletonCards, StatusBadge } from '../../components/ui/index.jsx';
import { assetUrl, errorMessage, post } from '../../lib/api.js';
import { cn, fmtDate, fmtDateTime, fmtRange } from '../../lib/utils.js';
import { KEYS, useMyApplications, useMyBooths, usePageReveal } from './shared.js';

const STATUS_LABEL = { pending: 'Pending Review', approved: 'Approved', rejected: 'Rejected', withdrawn: 'Withdrawn' };
const STEP_STYLE = {
  done: ['text-success', CheckCircle2, 'completed'],
  current: ['text-warning', Clock, 'in progress'],
  failed: ['text-danger', XCircle, 'not completed'],
  upcoming: ['text-muted', Circle, 'upcoming'],
};

/** Submitted -> reviewed -> booth, derived from the application and any booth held at that expo. */
function timelineSteps(application, booth) {
  const { status } = application;
  const review = {
    pending: { label: 'Under review', state: 'current' },
    approved: { label: 'Approved', state: 'done', date: application.reviewedAt },
    rejected: { label: 'Not approved', state: 'failed', date: application.reviewedAt },
    withdrawn: { label: 'Withdrawn', state: 'failed', date: application.updatedAt },
  }[status];
  const boothStep = booth
    ? { label: booth.status === 'booked' ? `Booth ${booth.code} confirmed` : `Booth ${booth.code} pending approval`, state: booth.status === 'booked' ? 'done' : 'current' }
    : { label: 'Reserve a booth', state: status === 'approved' ? 'current' : 'upcoming' };
  return [{ label: 'Submitted', state: 'done', date: application.createdAt }, review, boothStep];
}

function Timeline({ steps }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Application progress">
      {steps.map((s) => {
        const [color, Icon, spoken] = STEP_STYLE[s.state];
        return (
          <li key={s.label} className="flex items-start gap-2.5">
            <Icon className={cn('size-5 shrink-0 mt-0.5', color)} aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{s.label}<span className="sr-only"> ({spoken})</span></p>
              <p className="text-xs text-muted">{s.date ? fmtDateTime(s.date) : '—'}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ApplicationCard({ application, booth, onWithdraw }) {
  const { expo, status } = application;
  const canWithdraw = ['pending', 'approved'].includes(status);
  return (
    <Card data-reveal className="p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{expo.title}</h2>
          <p className="text-sm text-muted flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <span className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden />{fmtRange(expo.startDate, expo.endDate)}</span>
            {expo.location?.venue && <span className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{[expo.location.venue, expo.location.city].filter(Boolean).join(', ')}</span>}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <Timeline steps={timelineSteps(application, booth)} />

      {status === 'rejected' && (
        <Alert tone="danger" title="Your application was not approved">{application.rejectionReason || 'The organizer did not provide a reason.'}</Alert>
      )}

      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div><dt className="text-xs uppercase tracking-wide text-muted font-semibold">Products &amp; services</dt><dd className="mt-0.5 break-words">{application.productsServices || '—'}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-muted font-semibold">Preferred booth size</dt><dd className="mt-0.5 capitalize">{application.preferredBoothSize || 'any'}</dd></div>
        {application.message && <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-muted font-semibold">Your message</dt><dd className="mt-0.5 break-words whitespace-pre-wrap">{application.message}</dd></div>}
        {application.documents?.length > 0 && (
          <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-muted font-semibold">Documents</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {application.documents.map((d) => (
                <a key={d.url} href={assetUrl(d.url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[13px] font-medium hover:bg-surface-2">
                  <ExternalLink className="size-3.5" aria-hidden />{d.name || 'Document'}
                </a>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {status === 'approved' && <Button to={`/exhibitor/booths?expo=${expo._id}`} icon={Store}>{booth ? 'Manage booth' : 'Reserve a booth'}</Button>}
        {['rejected', 'withdrawn'].includes(status) && <Button to="/exhibitor/expos" variant="secondary" icon={Ticket}>Apply again</Button>}
        {canWithdraw && <Button variant="ghost" icon={Undo2} className="hover:text-danger" onClick={() => onWithdraw(application)}>Withdraw application</Button>}
        <span className="ml-auto text-xs text-muted">Last updated {fmtDate(application.updatedAt)}</span>
      </div>
    </Card>
  );
}

export default function Applications() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useMyApplications();
  const { data: booths } = useMyBooths();
  const ref = usePageReveal(data);
  const [filter, setFilter] = useState('all');
  const [withdrawing, setWithdrawing] = useState(null);

  const counts = useMemo(() => (data || []).reduce((m, a) => ({ ...m, [a.status]: (m[a.status] || 0) + 1 }), {}), [data]);
  const visible = (data || []).filter((a) => filter === 'all' || a.status === filter);
  const options = [{ value: 'all', label: `All (${data?.length || 0})` }, ...Object.keys(STATUS_LABEL).filter((s) => counts[s]).map((s) => ({ value: s, label: `${STATUS_LABEL[s]} (${counts[s]})` }))];

  const withdraw = useMutation({
    mutationFn: (id) => post(`/applications/${id}/withdraw`),
    onSuccess: () => {
      [KEYS.applications, KEYS.myBooths, KEYS.dashboard, ['booths']].forEach((queryKey) => qc.invalidateQueries({ queryKey }));
      toast.success('Application withdrawn');
      setWithdrawing(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      if (err?.response?.status === 409) setWithdrawing(null);
    },
  });

  return (
    <div ref={ref}>
      <PageHeader title="My applications" subtitle="Follow each application from submission to booth confirmation." actions={<Button to="/exhibitor/expos" variant="secondary" icon={Ticket}>Find expos</Button>} />

      {isLoading && <SkeletonCards n={2} className="h-64" />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && data.length === 0 && (
        <Card><EmptyState icon={ClipboardCheck} title="No applications yet" text="Apply to an upcoming expo to start the journey to your booth." action={<Button to="/exhibitor/expos" icon={Ticket}>Browse expos</Button>} /></Card>
      )}
      {data?.length > 0 && (
        <>
          <div className="mb-5"><Chips label="Filter by status" options={options} value={filter} onChange={setFilter} /></div>
          <div className="grid gap-5 xl:grid-cols-2">
            {visible.map((a) => (
              <ApplicationCard key={a._id} application={a} booth={(booths || []).find((b) => b.expo._id === a.expo._id)} onWithdraw={setWithdrawing} />
            ))}
          </div>
        </>
      )}

      <ConfirmModal open={!!withdrawing} onClose={() => setWithdrawing(null)} loading={withdraw.isPending} title="Withdraw this application?" confirmText="Withdraw"
        message={`Your application to ${withdrawing?.expo.title} will be withdrawn${withdrawing?.status === 'approved' ? ' and any pending booth reservations will be released' : ''}. You can apply again later.`}
        onConfirm={() => withdraw.mutate(withdrawing._id)} />
    </div>
  );
}
