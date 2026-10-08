import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CalendarClock, Check, CheckCheck, Handshake, Mail, MessageSquare, X } from 'lucide-react';
import { Avatar, Button, Card, Chips, EmptyState, ErrorState, IconButton, PageHeader, Skeleton, SkeletonCards, StatusBadge } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { errorMessage, get, patch, post } from '../../lib/api.js';
import { cn, fmtDateTime, timeAgo } from '../../lib/utils.js';
import { KEYS, usePageReveal, useSocketEvents } from './shared.js';
import { Composer, MessageList } from './Thread.jsx';

const FILTERS = [['all', 'All'], ['pending', 'Pending'], ['accepted', 'Accepted'], ['declined', 'Declined'], ['completed', 'Completed']];
const listKey = [...KEYS.inquiries, 'list'];

function InquiryRow({ inquiry, active, onOpen }) {
  const Icon = inquiry.type === 'appointment' ? CalendarClock : MessageSquare;
  return (
    <li>
      <button type="button" onClick={() => onOpen(inquiry._id)} aria-current={active ? 'true' : undefined}
        className={cn('w-full text-left px-4 py-3.5 flex gap-3 border-b border-line/70 transition hover:bg-surface-2/70', active && 'bg-primary-soft')}>
        <Avatar name={inquiry.attendee?.name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="font-semibold truncate">{inquiry.attendee?.name || 'Visitor'}</span>
            <span className="text-xs text-muted shrink-0">{timeAgo(inquiry.updatedAt)}</span>
          </span>
          <span className="block text-sm truncate"><Icon className="size-3.5 inline -mt-0.5 mr-1 text-muted" aria-hidden />{inquiry.subject}</span>
          <span className="mt-1.5 flex items-center gap-2">
            <StatusBadge status={inquiry.status} label={inquiry.status === 'pending' ? 'Awaiting reply' : undefined} />
            {inquiry.type === 'appointment' && inquiry.appointmentAt && <span className="text-xs text-muted truncate">{fmtDateTime(inquiry.appointmentAt)}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function InquiryDetail({ id, onBack }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: inquiry, isLoading, error, refetch } = useQuery({ queryKey: [...KEYS.inquiries, id], queryFn: () => get(`/inquiries/${id}`).then((d) => d.inquiry) });

  const refresh = () => qc.invalidateQueries({ queryKey: KEYS.inquiries });
  const reply = useMutation({
    mutationFn: (body) => post(`/inquiries/${id}/messages`, { body }),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });
  const setStatus = useMutation({
    mutationFn: (status) => patch(`/inquiries/${id}/status`, { status }),
    onSuccess: (_res, status) => { refresh(); toast.success(`Inquiry marked as ${status}`); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const messages = useMemo(() => (inquiry?.messages || []).map((m) => ({
    id: m._id, mine: m.sender?._id === user._id, author: m.sender?.name || 'Visitor', body: m.body, at: m.at,
  })), [inquiry, user._id]);

  const back = <IconButton label="Back to inquiries" icon={ArrowLeft} className="lg:hidden -ml-2" onClick={onBack} />;
  if (isLoading) return <div className="p-5 space-y-4"><Skeleton className="h-16" /><Skeleton className="h-64" /></div>;
  if (error) return <div className="p-5"><ErrorState error={error} onRetry={refetch} /></div>;

  const busy = setStatus.isPending;
  return (
    <>
      <header className="p-4 sm:p-5 border-b border-line space-y-3">
        <div className="flex items-start gap-2">
          {back}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-snug break-words">{inquiry.subject}</h2>
            <p className="text-sm text-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              <span>{inquiry.attendee?.name}</span>
              {inquiry.attendee?.email && <a href={`mailto:${inquiry.attendee.email}`} className="inline-flex items-center gap-1 text-primary-text hover:underline"><Mail className="size-3.5" aria-hidden />{inquiry.attendee.email}</a>}
              <span>{inquiry.expo?.title}</span>
            </p>
          </div>
          <StatusBadge status={inquiry.status} label={inquiry.status === 'pending' ? 'Awaiting reply' : undefined} />
        </div>
        {inquiry.type === 'appointment' && (
          <p className="inline-flex items-center gap-2 rounded-xl bg-info-soft text-info-text px-3 py-2 text-sm font-semibold">
            <CalendarClock className="size-4" aria-hidden />Appointment requested for {fmtDateTime(inquiry.appointmentAt)}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {inquiry.status === 'pending' && (
            <>
              <Button variant="success" size="sm" icon={Check} loading={busy && setStatus.variables === 'accepted'} disabled={busy} onClick={() => setStatus.mutate('accepted')}>Accept</Button>
              <Button variant="secondary" size="sm" icon={X} loading={busy && setStatus.variables === 'declined'} disabled={busy} onClick={() => setStatus.mutate('declined')}>Decline</Button>
            </>
          )}
          {inquiry.status === 'accepted' && <Button variant="secondary" size="sm" icon={CheckCheck} loading={busy} onClick={() => setStatus.mutate('completed')}>Mark completed</Button>}
        </div>
      </header>
      <MessageList messages={messages} label="Conversation" />
      <Composer onSend={reply.mutateAsync} pending={reply.isPending} label="Write a reply" />
    </>
  );
}

export default function Inquiries() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const activeId = params.get('id');
  const filter = params.get('status') || 'all';
  const { data, isLoading, error, refetch } = useQuery({ queryKey: listKey, queryFn: () => get('/inquiries').then((d) => d.items) });
  const ref = usePageReveal(data);

  useSocketEvents(['inquiry:updated'], () => qc.invalidateQueries({ queryKey: KEYS.inquiries }));

  const updateParams = (key, value) => setParams((p) => {
    const next = new URLSearchParams(p);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });
  const open = (id) => updateParams('id', id);

  const counts = useMemo(() => (data || []).reduce((m, i) => ({ ...m, [i.status]: (m[i.status] || 0) + 1 }), {}), [data]);
  const options = FILTERS.map(([value, label]) => ({ value, label: `${label} (${value === 'all' ? data?.length || 0 : counts[value] || 0})` }));
  const rows = (data || []).filter((i) => filter === 'all' || i.status === filter);

  return (
    <div ref={ref}>
      <PageHeader title="Visitor inquiries" subtitle="Answer questions and manage appointment requests from attendees." />
      {isLoading && <SkeletonCards n={3} className="h-28" />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data?.length === 0 && <Card data-reveal><EmptyState icon={Handshake} title="No inquiries yet" text="When visitors ask about your products or request a meeting, it will show up here." /></Card>}
      {data?.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[23rem_minmax(0,1fr)] lg:h-[calc(100dvh-13rem)] lg:min-h-[34rem]">
          <Card data-reveal className={cn('flex-col overflow-hidden max-h-[75dvh] lg:max-h-none', activeId ? 'hidden lg:flex' : 'flex')}>
            <div className="p-3 border-b border-line overflow-x-auto"><Chips label="Filter inquiries by status" options={options} value={filter} onChange={(status) => updateParams('status', status)} /></div>
            {rows.length === 0 ? <p className="p-6 text-sm text-muted text-center">No inquiries with this status.</p> : (
              <ul className="overflow-y-auto flex-1" aria-label="Inquiries">
                {rows.map((i) => <InquiryRow key={i._id} inquiry={i} active={i._id === activeId} onOpen={open} />)}
              </ul>
            )}
          </Card>
          <Card data-reveal className={cn('flex-col overflow-hidden h-[75dvh] lg:h-auto', activeId ? 'flex' : 'hidden lg:flex')}>
            {activeId ? <InquiryDetail key={activeId} id={activeId} onBack={() => open(null)} />
              : <EmptyState icon={MessageSquare} title="Select an inquiry" text="Choose a conversation on the left to read and reply." className="my-auto" />}
          </Card>
        </div>
      )}
    </div>
  );
}
