import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ClipboardCheck, ExternalLink, Eye, FileText, X } from 'lucide-react';
import { assetUrl, errorMessage, fieldErrors, get, patch } from '../../lib/api.js';
import { fmtDate, fmtDateTime } from '../../lib/utils.js';
import { useDebounced, useExpos, useReveal, useSocketEvent } from '../../hooks/index.js';
import {
  Alert, Avatar, Badge, Button, Card, DataTable, Dl, EmptyState, ErrorState, Modal, PageHeader, Pagination, SearchInput, Select, Skeleton, StatusBadge, Tabs, Textarea,
} from '../../components/ui/index.jsx';
import { useUrlState } from './shared.jsx';

const STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'];
const TAB_LABEL = { all: 'All', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', withdrawn: 'Withdrawn' };
const SIZE_LABEL = { small: 'Small', medium: 'Medium', large: 'Large', any: 'Any size' };
const LIMIT = 10;

export default function Applications() {
  const qc = useQueryClient();
  const [status, setStatus] = useUrlState('status', 'pending');
  const [expo, setExpo] = useUrlState('expo', '');
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 350).trim();
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  const closeReject = useCallback(() => setRejecting(null), []);

  useEffect(() => setPage(1), [status, expo, q]);

  const expos = useExpos({ mine: true, limit: 100 });
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['applications', { status, expo, q, page }],
    queryFn: () => get('/applications', { status: status === 'all' ? undefined : status, expo: expo || undefined, q: q || undefined, page, limit: LIMIT }),
    placeholderData: keepPreviousData,
  });
  useSocketEvent('application:new', () => qc.invalidateQueries({ queryKey: ['applications'] }));

  const approve = useMutation({
    mutationFn: (a) => patch(`/applications/${a._id}/review`, { status: 'approved' }),
    onSuccess: (_r, a) => {
      toast.success(`${a.profile?.companyName || 'Application'} approved. The exhibitor was notified.`);
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['approved-exhibitors'] });
      closeDetail();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const counts = data?.counts || {};
  const tabs = useMemo(() => [
    { id: 'all', label: TAB_LABEL.all, count: STATUSES.reduce((n, s) => n + (counts[s] || 0), 0) },
    ...STATUSES.map((s) => ({ id: s, label: TAB_LABEL[s], count: counts[s] || 0 })),
  ], [counts]);
  const tableRef = useReveal('[data-reveal]', [!!data, status]);

  const columns = [
    {
      key: 'company', header: 'Company', render: (a) => (
        <div className="flex items-center gap-3 min-w-52">
          <Avatar name={a.profile?.companyName} src={a.profile?.logo} square />
          <div className="min-w-0">
            <button type="button" onClick={() => setDetail(a)} className="font-semibold text-left hover:underline">{a.profile?.companyName || 'Unknown company'}</button>
            {a.profile?.tagline && <p className="text-[13px] text-muted truncate max-w-56">{a.profile.tagline}</p>}
          </div>
        </div>
      ),
    },
    { key: 'contact', header: 'Contact', render: (a) => <div className="min-w-40"><p className="font-medium">{a.exhibitor?.name}</p><p className="text-[13px] text-muted">{a.exhibitor?.email}</p></div> },
    { key: 'expo', header: 'Expo', render: (a) => <span className="min-w-36 inline-block">{a.expo?.title}</span> },
    { key: 'products', header: 'Products / services', render: (a) => <p className="line-clamp-2 min-w-52 max-w-72 text-muted">{a.productsServices || '—'}</p> },
    { key: 'size', header: 'Booth size', render: (a) => SIZE_LABEL[a.preferredBoothSize] || '—' },
    { key: 'submitted', header: 'Submitted', render: (a) => <span className="whitespace-nowrap">{fmtDate(a.createdAt)}</span> },
    { key: 'docs', header: 'Documents', render: (a) => <DocLinks docs={a.documents} /> },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', render: (a) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" icon={Eye} onClick={() => setDetail(a)} aria-label={`View application from ${a.profile?.companyName}`}>View</Button>
          {a.status === 'pending' && (
            <>
              <Button size="sm" variant="success" icon={Check} loading={approve.isPending && approve.variables?._id === a._id} onClick={() => approve.mutate(a)} aria-label={`Approve ${a.profile?.companyName}`}>Approve</Button>
              <Button size="sm" variant="secondary" icon={X} onClick={() => setRejecting(a)} aria-label={`Reject ${a.profile?.companyName}`}>Reject</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Exhibitor applications" subtitle="Review companies that want to take part in your expos." />

      <Card className="mb-5">
        <Tabs label="Application status" tabs={tabs} value={status} onChange={setStatus} className="px-3" />
        <div className="p-4 grid gap-3 sm:grid-cols-2 items-end">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by company name" />
          <Select label="Expo" value={expo} onChange={(e) => setExpo(e.target.value)} placeholder="All expos"
            options={(expos.data?.items || []).map((e) => ({ value: e._id, label: e.title }))} />
        </div>
      </Card>

      <div role="tabpanel" aria-labelledby={`tab-${status}`} ref={tableRef}>
        {isLoading ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          : isError ? <ErrorState error={error} onRetry={refetch} />
            : (
              <Card data-reveal className="overflow-hidden">
                <DataTable columns={columns} rows={data.items} caption={`${TAB_LABEL[status]} exhibitor applications`}
                  empty={<EmptyState icon={ClipboardCheck} title={q || expo ? 'No applications match your filters' : `No ${status === 'all' ? '' : `${status} `}applications`}
                    text={status === 'pending' && !q && !expo ? 'You are all caught up. New applications appear here as exhibitors apply.' : 'Try another status tab or clear the filters.'} />} />
                <div className="px-4 pb-4"><Pagination pagination={data.pagination} onPage={setPage} /></div>
              </Card>
            )}
      </div>

      {detail && <DetailModal application={detail} onClose={closeDetail} onApprove={() => approve.mutate(detail)} approving={approve.isPending}
        onReject={() => { setRejecting(detail); closeDetail(); }} />}
      {rejecting && <RejectModal application={rejecting} onClose={closeReject} />}
    </>
  );
}

function DocLinks({ docs }) {
  if (!docs?.length) return <span className="text-muted">None</span>;
  return (
    <ul className="space-y-1 min-w-32">
      {docs.slice(0, 2).map((d) => (
        <li key={d.url}>
          <a href={assetUrl(d.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary-text font-medium hover:underline">
            <FileText className="size-4 shrink-0" aria-hidden /><span className="truncate max-w-32">{d.name || 'Document'}</span><span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
      {docs.length > 2 && <li className="text-[13px] text-muted">+{docs.length - 2} more in details</li>}
    </ul>
  );
}

function DetailModal({ application: a, onClose, onApprove, onReject, approving }) {
  const p = a.profile || {};
  return (
    <Modal open onClose={onClose} size="lg" title={p.companyName || 'Application'} description={`Applied to ${a.expo?.title} on ${fmtDate(a.createdAt)}`}
      footer={a.status === 'pending' ? (
        <>
          <Button variant="secondary" icon={X} onClick={onReject}>Reject…</Button>
          <Button variant="success" icon={Check} loading={approving} onClick={onApprove}>Approve</Button>
        </>
      ) : <Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar name={p.companyName} src={p.logo} size="lg" square />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={a.status} />{a.status === 'approved' && a.reviewedAt && <span className="text-sm text-muted">on {fmtDate(a.reviewedAt)}</span>}</div>
            {p.tagline && <p className="mt-1 text-muted">{p.tagline}</p>}
            {!!p.categories?.length && <div className="mt-2 flex flex-wrap gap-1.5">{p.categories.map((c) => <Badge key={c} tone="primary">{c}</Badge>)}</div>}
          </div>
        </div>

        {a.status === 'rejected' && a.rejectionReason && <Alert tone="danger" title="Rejection reason">{a.rejectionReason}</Alert>}

        <Dl items={[
          ['Contact person', a.exhibitor?.name],
          ['Email', a.exhibitor?.email || p.contact?.email],
          ['Phone', a.exhibitor?.phone || p.contact?.phone],
          ['Expo', a.expo?.title],
          ['Preferred booth size', SIZE_LABEL[a.preferredBoothSize]],
          ['Submitted', fmtDateTime(a.createdAt)],
        ]} />

        <section aria-labelledby="app-products">
          <h3 id="app-products" className="text-sm font-bold mb-1">Products and services</h3>
          <p className="whitespace-pre-line">{a.productsServices || 'Not provided'}</p>
        </section>
        <section aria-labelledby="app-message">
          <h3 id="app-message" className="text-sm font-bold mb-1">Message to the organizer</h3>
          <p className="whitespace-pre-line">{a.message || 'Not provided'}</p>
        </section>
        <section aria-labelledby="app-docs">
          <h3 id="app-docs" className="text-sm font-bold mb-2">Documents</h3>
          {a.documents?.length ? (
            <ul className="space-y-1.5">
              {a.documents.map((d) => (
                <li key={d.url}>
                  <a href={assetUrl(d.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary-text font-medium hover:underline">
                    <FileText className="size-4" aria-hidden />{d.name || 'Document'}<ExternalLink className="size-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted">No documents attached</p>}
        </section>
      </div>
    </Modal>
  );
}

function RejectModal({ application: a, onClose }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const reject = useMutation({
    mutationFn: () => patch(`/applications/${a._id}/review`, { status: 'rejected', reason: reason.trim() }),
    onSuccess: () => {
      toast.success(`${a.profile?.companyName || 'Application'} rejected`);
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      onClose();
    },
    onError: (err) => { const fe = fieldErrors(err); if (fe.reason) setError(fe.reason); else toast.error(errorMessage(err)); },
  });
  const submit = (e) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Please give a reason so the exhibitor knows what to improve'); return; }
    reject.mutate();
  };
  return (
    <Modal open onClose={onClose} title={`Reject ${a.profile?.companyName || 'application'}?`} description="The exhibitor is notified and sees your reason."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="reject-form" variant="danger" loading={reject.isPending}>Reject application</Button></>}>
      <form id="reject-form" onSubmit={submit} noValidate>
        <Textarea label="Reason for rejection" required rows={4} maxLength={500} data-autofocus value={reason} error={error}
          onChange={(e) => { setReason(e.target.value); setError(''); }} hint={`${reason.length}/500`} />
      </form>
    </Modal>
  );
}
