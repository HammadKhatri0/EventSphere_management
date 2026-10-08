import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LifeBuoy, Send, UserCheck, UserMinus } from 'lucide-react';
import { errorMessage, fieldErrors, get, patch, post } from '../../lib/api.js';
import { cn, fmtDateTime, ROLE_LABEL, timeAgo } from '../../lib/utils.js';
import { useDebounced, useSocketEvent } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Alert, Avatar, Badge, Button, Card, Chips, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Select, Skeleton, StatusBadge, Textarea,
} from '../../components/ui/index.jsx';
import { useMediaQuery } from './shared.jsx';

const STATUS_OPTIONS = [{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' }];
const PRIORITY_OPTIONS = [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }];
const FILTERS = [['', 'All'], ...STATUS_OPTIONS.map((o) => [o.value, o.label])];

export default function Support() {
  const qc = useQueryClient();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 350).trim();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const detailRef = useRef(null);

  useEffect(() => setPage(1), [status, q]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['tickets', { status, q, page }],
    queryFn: () => get('/tickets', { status: status || undefined, q: q || undefined, page, limit: 15 }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['tickets'] });
    qc.invalidateQueries({ queryKey: ['ticket'] });
    qc.invalidateQueries({ queryKey: ['analytics', 'overview'] });
  };
  useSocketEvent('ticket:new', refresh);
  useSocketEvent('ticket:updated', refresh);

  const counts = data?.counts || {};
  const total = Object.values(counts).reduce((n, c) => n + c, 0);
  const activeId = selectedId || (isDesktop ? data?.items[0]?._id : null);

  const select = (id) => {
    setSelectedId(id);
    if (!isDesktop) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start' }));
  };

  return (
    <>
      <PageHeader title="Support tickets" subtitle="Answer exhibitor questions and keep track of open requests." />

      <div className="grid gap-6 lg:grid-cols-[minmax(300px,400px)_minmax(0,1fr)] items-start">
        <section aria-label="Ticket list" className="space-y-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by subject" />
          <Chips label="Filter by status" value={status} onChange={setStatus}
            options={FILTERS.map(([value, label]) => ({ value, label: `${label} (${value ? counts[value] || 0 : total})` }))} />

          {isLoading ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
            : isError ? <ErrorState error={error} onRetry={refetch} />
              : !data.items.length ? <Card><EmptyState icon={LifeBuoy} title="No tickets found" text={q || status ? 'Try clearing the filters.' : 'New exhibitor requests will appear here.'} className="py-10" /></Card>
                : (
                  <>
                    <ul className="space-y-2">
                      {data.items.map((t) => (
                        <li key={t._id} data-reveal>
                          <button type="button" onClick={() => select(t._id)} aria-current={t._id === activeId ? 'true' : undefined}
                            className={cn('w-full text-left card p-4 transition hover:border-primary', t._id === activeId && 'border-primary ring-2 ring-primary/30')}>
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-bold leading-snug">{t.subject}</p>
                              <span className="text-xs text-muted whitespace-nowrap">{timeAgo(t.updatedAt)}</span>
                            </div>
                            <p className="text-[13px] text-muted mt-0.5 truncate">{t.exhibitor?.company || t.exhibitor?.name || 'Exhibitor'}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                              <StatusBadge status={t.status} />
                              <StatusBadge status={t.priority} label={`${t.priority[0].toUpperCase()}${t.priority.slice(1)} priority`} />
                              {t.assignedTo && <Badge>{t.assignedTo.name}</Badge>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <Pagination pagination={data.pagination} onPage={setPage} />
                  </>
                )}
        </section>

        <section ref={detailRef} aria-label="Ticket details" className="scroll-mt-20 min-w-0">
          {activeId ? <TicketDetail key={activeId} id={activeId} /> : (
            <Card><EmptyState icon={LifeBuoy} title="Select a ticket" text="Choose a ticket from the list to read the conversation and reply." /></Card>
          )}
        </section>
      </div>
    </>
  );
}

function TicketDetail({ id }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [bodyError, setBodyError] = useState('');
  const threadRef = useRef(null);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['ticket', id], queryFn: () => get(`/tickets/${id}`) });
  const ticket = data?.ticket;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ticket', id] });
    qc.invalidateQueries({ queryKey: ['tickets'] });
    qc.invalidateQueries({ queryKey: ['analytics', 'overview'] });
  };
  const update = useMutation({
    mutationFn: (changes) => patch(`/tickets/${id}`, changes),
    onSuccess: () => { toast.success('Ticket updated'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const reply = useMutation({
    mutationFn: () => post(`/tickets/${id}/messages`, { body: body.trim() }),
    onSuccess: () => { toast.success('Reply sent'); setBody(''); refresh(); },
    onError: (err) => { const fe = fieldErrors(err); if (fe.body) setBodyError(fe.body); else toast.error(errorMessage(err)); },
  });

  const messageCount = ticket?.messages.length;
  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }, [messageCount]);

  if (isLoading) return <Skeleton className="h-96" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const mine = ticket.assignedTo?._id === user._id;
  const closed = ticket.status === 'closed';
  const submit = (e) => {
    e.preventDefault();
    if (!body.trim()) { setBodyError('Write a reply first'); return; }
    reply.mutate();
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-5 border-b border-line">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <StatusBadge status={ticket.status} />
          <StatusBadge status={ticket.priority} label={`${ticket.priority[0].toUpperCase()}${ticket.priority.slice(1)} priority`} />
          <Badge>{ticket.category}</Badge>
        </div>
        <h2 className="text-xl font-bold">{ticket.subject}</h2>
        <p className="text-sm text-muted mt-1">
          {ticket.exhibitor?.name}{ticket.exhibitor?.company && ` · ${ticket.exhibitor.company}`}{ticket.exhibitor?.email && ` · ${ticket.exhibitor.email}`}
          {' · opened '}{fmtDateTime(ticket.createdAt)}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 items-end">
          <Select label="Status" value={ticket.status} options={STATUS_OPTIONS} disabled={update.isPending} onChange={(e) => update.mutate({ status: e.target.value })} />
          <Select label="Priority" value={ticket.priority} options={PRIORITY_OPTIONS} disabled={update.isPending} onChange={(e) => update.mutate({ priority: e.target.value })} />
          <Button variant={mine ? 'secondary' : 'soft'} icon={mine ? UserMinus : UserCheck} loading={update.isPending && update.variables?.assignedTo !== undefined}
            onClick={() => update.mutate({ assignedTo: mine ? null : user._id })} className="h-11">{mine ? 'Unassign me' : 'Assign to me'}</Button>
        </div>
        <p className="text-[13px] text-muted mt-2">{ticket.assignedTo ? `Assigned to ${mine ? 'you' : ticket.assignedTo.name}` : 'Not assigned yet'}</p>
      </div>

      <div ref={threadRef} className="p-5 space-y-4 max-h-[26rem] overflow-y-auto bg-surface-2/40" role="log" aria-label="Conversation">
        {ticket.messages.map((m) => {
          const staff = m.sender?.role === 'admin';
          return (
            <div key={m._id} className={cn('flex gap-3', staff && 'flex-row-reverse')}>
              <Avatar name={m.sender?.name} size="sm" />
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 border', staff ? 'bg-primary-soft border-transparent' : 'bg-surface border-line')}>
                <p className="text-[13px]"><span className="font-bold">{m.sender?.name || 'Former user'}</span> <span className="text-muted">· {ROLE_LABEL[m.sender?.role] || 'User'} · {fmtDateTime(m.at)}</span></p>
                <p className="mt-1 whitespace-pre-line break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} noValidate className="p-5 border-t border-line space-y-3">
        {closed && <Alert tone="warning">This ticket is closed. Change its status to reopen it before replying.</Alert>}
        <Textarea label={`Reply to ${ticket.exhibitor?.name || 'exhibitor'}`} rows={3} maxLength={3000} value={body} error={bodyError} disabled={closed}
          onChange={(e) => { setBody(e.target.value); setBodyError(''); }} />
        <div className="flex justify-end"><Button type="submit" icon={Send} loading={reply.isPending} disabled={closed}>Send reply</Button></div>
      </form>
    </Card>
  );
}
