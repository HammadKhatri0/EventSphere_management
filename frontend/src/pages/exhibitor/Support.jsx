import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, LifeBuoy, Lock, MessageSquare, Plus, RotateCcw } from 'lucide-react';
import {
  Alert, Badge, Button, Card, Chips, EmptyState, ErrorState, IconButton, Modal, PageHeader, Pagination, SearchInput, Select, Skeleton, SkeletonCards, StatusBadge, Textarea, Input,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDebounced, useForm } from '../../hooks/index.js';
import { errorMessage, fieldErrors, get, patch, post } from '../../lib/api.js';
import { cn, fmtDateTime, timeAgo } from '../../lib/utils.js';
import { KEYS, useMyApplications, usePageReveal, useSocketEvents } from './shared.js';
import { Composer, MessageList } from './Thread.jsx';

const STATUS_FILTERS = [['', 'All'], ['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed']];
const CATEGORIES = [{ value: 'booth', label: 'Booth' }, { value: 'billing', label: 'Billing' }, { value: 'technical', label: 'Technical' }, { value: 'schedule', label: 'Schedule' }, { value: 'other', label: 'Other' }];
const PRIORITIES = [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }];
const PAGE_SIZE = 15;
const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label || value;

const PriorityBadge = ({ priority }) => <StatusBadge status={priority} label={`${priority[0].toUpperCase()}${priority.slice(1)} priority`} />;

function NewTicketModal({ onClose, onCreated }) {
  const qc = useQueryClient();
  const { data: applications } = useMyApplications();
  const form = useForm({ subject: '', category: 'other', priority: 'medium', expoId: '', message: '' });
  const expoOptions = useMemo(() => [...new Map((applications || []).map((a) => [a.expo._id, a.expo.title])).entries()].map(([value, label]) => ({ value, label })), [applications]);

  const create = useMutation({
    mutationFn: () => post('/tickets', { ...form.values, expoId: form.values.expoId || undefined }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: KEYS.tickets });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
      toast.success('Ticket sent to the organizers');
      onCreated(res.data.ticket._id);
    },
    onError: (err) => {
      const fields = fieldErrors(err);
      form.setErrors(fields);
      if (!Object.keys(fields).length) toast.error(errorMessage(err));
    },
  });

  return (
    <Modal open onClose={onClose} size="lg" title="New support ticket" description="Describe the problem and the organizers will get back to you."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="ticket-form" loading={create.isPending}>Send ticket</Button></>}>
      <form id="ticket-form" noValidate onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid gap-4 sm:grid-cols-2">
        <Input label="Subject" required maxLength={140} data-autofocus wrapperClassName="sm:col-span-2" {...form.bind('subject')} />
        <Select label="Category" options={CATEGORIES} {...form.bind('category')} />
        <Select label="Priority" options={PRIORITIES} {...form.bind('priority')} />
        <Select label="Related expo (optional)" placeholder="Not related to a specific expo" options={expoOptions} wrapperClassName="sm:col-span-2" {...form.bind('expoId')} />
        <Textarea label="Message" required rows={5} maxLength={3000} wrapperClassName="sm:col-span-2" {...form.bind('message')} />
      </form>
    </Modal>
  );
}

function TicketRow({ ticket, active, onOpen }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(ticket._id)} aria-current={active ? 'true' : undefined}
        className={cn('w-full text-left px-4 py-3.5 border-b border-line/70 transition hover:bg-surface-2/70', active && 'bg-primary-soft')}>
        <span className="flex items-start justify-between gap-2">
          <span className="font-semibold line-clamp-2">{ticket.subject}</span>
          <span className="text-xs text-muted shrink-0 mt-0.5">{timeAgo(ticket.updatedAt)}</span>
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <Badge>{categoryLabel(ticket.category)}</Badge>
          <PriorityBadge priority={ticket.priority} />
        </span>
      </button>
    </li>
  );
}

function TicketDetail({ id, onBack }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: ticket, isLoading, error, refetch } = useQuery({ queryKey: [...KEYS.tickets, id], queryFn: () => get(`/tickets/${id}`).then((d) => d.ticket) });

  const refresh = () => qc.invalidateQueries({ queryKey: KEYS.tickets });
  const reply = useMutation({
    mutationFn: (body) => post(`/tickets/${id}/messages`, { body }),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });
  const setStatus = useMutation({
    mutationFn: (status) => patch(`/tickets/${id}`, { status }),
    onSuccess: (_res, status) => { refresh(); toast.success(status === 'closed' ? 'Ticket closed' : 'Ticket reopened'); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const messages = useMemo(() => (ticket?.messages || []).map((m) => ({
    id: m._id, mine: m.sender?._id === user._id, author: m.sender?.role === 'admin' ? `${m.sender.name} (Organizer)` : m.sender?.name || 'Organizer', body: m.body, at: m.at,
  })), [ticket, user._id]);

  if (isLoading) return <div className="p-5 space-y-4"><Skeleton className="h-16" /><Skeleton className="h-64" /></div>;
  if (error) return <div className="p-5"><ErrorState error={error} onRetry={refetch} /></div>;

  const closed = ticket.status === 'closed';
  return (
    <>
      <header className="p-4 sm:p-5 border-b border-line space-y-3">
        <div className="flex items-start gap-2">
          <IconButton label="Back to tickets" icon={ArrowLeft} className="lg:hidden -ml-2" onClick={onBack} />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-snug break-words">{ticket.subject}</h2>
            <p className="text-sm text-muted mt-0.5">Opened {fmtDateTime(ticket.createdAt)}{ticket.assignedTo && ` · Assigned to ${ticket.assignedTo.name}`}</p>
          </div>
          {closed
            ? <Button variant="secondary" size="sm" icon={RotateCcw} loading={setStatus.isPending} onClick={() => setStatus.mutate('open')}>Reopen</Button>
            : <Button variant="secondary" size="sm" icon={Lock} loading={setStatus.isPending} onClick={() => setStatus.mutate('closed')}>Close ticket</Button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={ticket.status} />
          <Badge>{categoryLabel(ticket.category)}</Badge>
          <PriorityBadge priority={ticket.priority} />
        </div>
      </header>
      <MessageList messages={messages} label={`Conversation about ${ticket.subject}`} />
      {closed
        ? <div className="p-3 border-t border-line"><Alert tone="info">This ticket is closed. Reopen it to send another message.</Alert></div>
        : <Composer onSend={reply.mutateAsync} pending={reply.isPending} label="Write a reply" maxLength={3000} />}
    </>
  );
}

export default function Support() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useDebounced(search.trim());
  const activeId = params.get('id');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...KEYS.tickets, 'list', { status, q, page }],
    queryFn: () => get('/tickets', { status: status || undefined, q: q || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const ref = usePageReveal(data);
  useSocketEvents(['ticket:updated'], () => qc.invalidateQueries({ queryKey: KEYS.tickets }));

  const open = (id) => setParams(id ? { id } : {}, { replace: true });
  const counts = data?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const options = STATUS_FILTERS.map(([value, label]) => ({ value, label: `${label} (${value ? counts[value] || 0 : total})` }));
  const filtering = !!(status || q);

  return (
    <div ref={ref}>
      <PageHeader title="Support tickets" subtitle="Get help from the organizers with booths, billing, schedules and more."
        actions={<Button icon={Plus} onClick={() => setCreating(true)}>New ticket</Button>} />

      {isLoading && <SkeletonCards n={3} className="h-24" />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && total === 0 && !filtering && (
        <Card data-reveal><EmptyState icon={LifeBuoy} title="No tickets yet" text="Need a hand? Open a ticket and the organizers will respond here."
          action={<Button icon={Plus} onClick={() => setCreating(true)}>New ticket</Button>} /></Card>
      )}
      {data && (total > 0 || filtering) && (
        <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)] lg:h-[calc(100dvh-13rem)] lg:min-h-[34rem]">
          <Card data-reveal className={cn('flex-col overflow-hidden max-h-[75dvh] lg:max-h-none', activeId ? 'hidden lg:flex' : 'flex')}>
            <div className="p-3 border-b border-line space-y-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search tickets by subject" />
              <Chips label="Filter tickets by status" options={options} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
            </div>
            {data.items.length === 0 ? <p className="p-6 text-sm text-muted text-center">No tickets match your filters.</p> : (
              <div className="overflow-y-auto flex-1">
                <ul aria-label="Tickets">{data.items.map((t) => <TicketRow key={t._id} ticket={t} active={t._id === activeId} onOpen={open} />)}</ul>
                <div className="px-4 pb-3"><Pagination pagination={data.pagination} onPage={setPage} /></div>
              </div>
            )}
          </Card>
          <Card data-reveal className={cn('flex-col overflow-hidden h-[75dvh] lg:h-auto', activeId ? 'flex' : 'hidden lg:flex')}>
            {activeId ? <TicketDetail key={activeId} id={activeId} onBack={() => open(null)} />
              : <EmptyState icon={MessageSquare} title="Select a ticket" text="Choose a ticket on the left to follow the conversation." className="my-auto" />}
          </Card>
        </div>
      )}

      {creating && <NewTicketModal onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); open(id); }} />}
    </div>
  );
}
