import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge, Textarea } from '../../components/ui/index.jsx';
import { errorMessage, get, post } from '../../lib/api.js';
import { cn, fmtDateTime, timeAgo } from '../../lib/utils.js';
import { useSocketEvent } from '../../hooks/index.js';
import { useUrlParams } from './attendeeShared.js';

const companyOf = (i) => i.company?.companyName || i.exhibitor?.company || i.exhibitor?.name || 'Exhibitor';

function InquiryRow({ inquiry, active, onSelect }) {
  const isAppointment = inquiry.type === 'appointment';
  return (
    <li>
      <button type="button" onClick={() => onSelect(inquiry._id)} aria-current={active ? 'true' : undefined}
        className={cn('w-full text-left p-4 flex gap-3 transition hover:bg-surface-2', active && 'bg-primary-soft hover:bg-primary-soft')}>
        <Avatar name={companyOf(inquiry)} src={inquiry.company?.logo} square />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center justify-between gap-2"><span className="font-bold truncate">{companyOf(inquiry)}</span><span className="text-xs text-muted shrink-0">{timeAgo(inquiry.updatedAt)}</span></span>
          <span className="block text-sm truncate">{inquiry.subject}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={inquiry.status} label={inquiry.status === 'pending' ? 'Awaiting reply' : undefined} />
            {isAppointment && <Badge tone="info" icon={CalendarClock}>Appointment</Badge>}
          </span>
        </span>
      </button>
    </li>
  );
}

function Thread({ id, onBack }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['inquiry', id], queryFn: () => get(`/inquiries/${id}`).then((d) => d.inquiry) });
  const [body, setBody] = useState('');
  const end = useRef(null);
  const count = query.data?.messages.length;

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [count, id]);

  const reply = useMutation({
    mutationFn: (text) => post(`/inquiries/${id}/messages`, { body: text }),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['inquiry', id] });
      qc.invalidateQueries({ queryKey: ['inquiries'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const send = (e) => {
    e.preventDefault();
    if (body.trim()) reply.mutate(body.trim());
  };

  if (query.isLoading) return <Skeleton className="h-96" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const inquiry = query.data;

  return (
    <Card className="flex flex-col min-h-[28rem]">
      <div className="p-4 sm:p-5 border-b border-line space-y-2">
        <button type="button" onClick={onBack} className="md:hidden inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"><ArrowLeft className="size-4" aria-hidden />All inquiries</button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{inquiry.subject}</h2>
          <StatusBadge status={inquiry.status} label={inquiry.status === 'pending' ? 'Awaiting reply' : undefined} />
        </div>
        <p className="text-sm text-muted">
          With {inquiry.company ? <Link className="font-semibold text-primary-text hover:underline" to={`/attendee/exhibitors/${inquiry.company._id}`}>{companyOf(inquiry)}</Link> : companyOf(inquiry)}
          {inquiry.expo?.title && ` · ${inquiry.expo.title}`}
        </p>
        {inquiry.type === 'appointment' && inquiry.appointmentAt && (
          <p className="inline-flex items-center gap-2 rounded-xl bg-info-soft text-info-text px-3 py-1.5 text-sm font-semibold"><CalendarClock className="size-4" aria-hidden />Appointment: {fmtDateTime(inquiry.appointmentAt)}</p>
        )}
      </div>

      <ol aria-label="Messages" className="flex-1 overflow-y-auto max-h-[28rem] p-4 sm:p-5 space-y-3">
        {inquiry.messages.map((m) => {
          const mine = m.sender?.role === 'attendee';
          return (
            <li key={m._id} className={cn('flex flex-col max-w-[85%]', mine ? 'ml-auto items-end' : 'items-start')}>
              <div className={cn('rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words', mine ? 'bg-primary text-white rounded-br-md' : 'bg-surface-2 rounded-bl-md')}>{m.body}</div>
              <span className="text-xs text-muted mt-1">{mine ? 'You' : m.sender?.name || companyOf(inquiry)} · {timeAgo(m.at)}</span>
            </li>
          );
        })}
        <li ref={end} aria-hidden />
      </ol>

      <form onSubmit={send} className="p-4 border-t border-line space-y-3">
        <Textarea label="Reply" rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e); }} hint="Press Ctrl + Enter to send." />
        <div className="flex justify-end"><Button type="submit" icon={Send} loading={reply.isPending} disabled={!body.trim()}>Send reply</Button></div>
      </form>
    </Card>
  );
}

export default function Inquiries() {
  const qc = useQueryClient();
  const [params, setParams] = useUrlParams();
  const list = useQuery({ queryKey: ['inquiries'], queryFn: () => get('/inquiries') });
  useSocketEvent('inquiry:updated', () => {
    qc.invalidateQueries({ queryKey: ['inquiries'] });
    qc.invalidateQueries({ queryKey: ['inquiry'] });
  });
  const items = list.data?.items || [];
  const selectedId = params.get('id') || '';
  const open = (id) => setParams({ id });

  return (
    <>
      <PageHeader title="Inquiries and appointments" subtitle="Conversations with exhibitors you reached out to."
        actions={<Button to="/attendee/exhibitors" variant="secondary">Find exhibitors</Button>} />

      {list.isLoading ? <div className="grid gap-4 md:grid-cols-[340px_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96 hidden md:block" /></div>
        : list.isError ? <ErrorState error={list.error} onRetry={list.refetch} />
        : !items.length ? (
          <Card><EmptyState icon={MessageSquare} title="No inquiries yet" text="Open an exhibitor profile to ask a question or book an appointment."
            action={<Button to="/attendee/exhibitors">Browse exhibitors</Button>} /></Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-[340px_1fr] items-start">
            <Card data-reveal as="section" aria-label="Your inquiries" className={cn('overflow-hidden', selectedId && 'hidden md:block')}>
              <ul className="divide-y divide-line">{items.map((i) => <InquiryRow key={i._id} inquiry={i} active={i._id === selectedId} onSelect={open} />)}</ul>
            </Card>
            <div className={cn(!selectedId && 'hidden md:block')}>
              {selectedId ? <Thread key={selectedId} id={selectedId} onBack={() => setParams({ id: '' })} />
                : <Card><EmptyState icon={MessageSquare} title="Select a conversation" text="Pick an inquiry on the left to read the thread and reply." /></Card>}
            </div>
          </div>
        )}
    </>
  );
}
