import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Mail, MapPin, MessageCircle, Phone, Send, Store, UsersRound } from 'lucide-react';
import {
  Avatar, Badge, Button, Card, Chips, EmptyState, ErrorState, IconButton, Modal, PageHeader, SearchInput, Select, Skeleton, SkeletonCards,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocketEvent } from '../../hooks/index.js';
import { errorMessage, get, post } from '../../lib/api.js';
import { cn, timeAgo } from '../../lib/utils.js';
import { KEYS, useMyBooths, usePageReveal } from './shared.js';
import { Composer, MessageList } from './Thread.jsx';

const SCOPES = [{ value: 'neighbors', label: 'Nearby booths' }, { value: 'all', label: 'All exhibitors' }];
const threadKey = (id) => ['conversation', id];
const displayName = (c) => c.with.companyName || c.with.name;

function ConversationRow({ convo, active, onOpen }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(convo._id)} aria-current={active ? 'true' : undefined}
        className={cn('w-full text-left px-4 py-3.5 flex gap-3 border-b border-line/70 transition hover:bg-surface-2/70', active && 'bg-primary-soft')}>
        <Avatar name={displayName(convo)} src={convo.with.logo} square />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className={cn('truncate', convo.unread ? 'font-extrabold' : 'font-semibold')}>{displayName(convo)}</span>
            <span className="text-xs text-muted shrink-0">{timeAgo(convo.lastAt)}</span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className={cn('text-sm truncate', convo.unread ? 'text-fg font-medium' : 'text-muted')}>{convo.lastMessage || 'No messages yet'}</span>
            {convo.unread > 0 && <Badge tone="primary">{convo.unread}<span className="sr-only"> unread</span></Badge>}
          </span>
        </span>
      </button>
    </li>
  );
}

function NeighborCard({ neighbor, onMessage, pending }) {
  const { contact = {} } = neighbor;
  return (
    <li className="rounded-2xl border border-line p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={neighbor.companyName} src={neighbor.logo} square size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold truncate">{neighbor.companyName}</h3>
          <p className="text-sm text-muted flex items-center gap-1.5"><Store className="size-3.5" aria-hidden />Booth {neighbor.booth} · {neighbor.distance === 0 ? 'Next to you' : `${neighbor.distance} units away`}</p>
          {neighbor.tagline && <p className="text-sm mt-1 line-clamp-2">{neighbor.tagline}</p>}
        </div>
        <Button size="sm" icon={Send} loading={pending} onClick={() => onMessage(neighbor.userId)}>Message</Button>
      </div>
      {(contact.email || contact.phone || contact.address) && (
        <ul className="grid gap-1.5 text-sm border-t border-line pt-3 sm:grid-cols-2">
          {contact.email && <li className="flex items-center gap-2 min-w-0"><Mail className="size-4 text-muted shrink-0" aria-hidden /><a href={`mailto:${contact.email}`} className="truncate text-primary-text hover:underline">{contact.email}</a></li>}
          {contact.phone && <li className="flex items-center gap-2"><Phone className="size-4 text-muted shrink-0" aria-hidden /><a href={`tel:${contact.phone}`} className="text-primary-text hover:underline">{contact.phone}</a></li>}
          {contact.address && <li className="flex items-center gap-2 min-w-0 sm:col-span-2"><MapPin className="size-4 text-muted shrink-0" aria-hidden /><span className="truncate">{contact.address}</span></li>}
        </ul>
      )}
    </li>
  );
}

/** Pick one of your expos and see neighbouring exhibitors with their contact details. */
function NeighborsModal({ onClose, onStarted }) {
  const qc = useQueryClient();
  const { data: booths, isLoading: loadingBooths } = useMyBooths();
  const expos = useMemo(() => {
    const held = (booths || []).filter((b) => ['reserved', 'booked'].includes(b.status));
    return [...new Map(held.map((b) => [b.expo._id, b.expo])).values()];
  }, [booths]);
  const [chosen, setChosen] = useState('');
  const [scope, setScope] = useState('neighbors');
  const expoId = chosen || expos[0]?._id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['neighbors', expoId, scope], enabled: !!expoId,
    queryFn: () => get('/exhibitors/neighbors', { expo: expoId, scope }).then((d) => d.items),
  });

  const start = useMutation({
    mutationFn: (userId) => post('/messages/conversations', { userId }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: KEYS.conversations });
      onStarted(res.data.conversationId);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal open onClose={onClose} size="lg" title="Find neighbours" description="Connect with exhibitors at your expos and exchange contact details.">
      {loadingBooths && <Skeleton className="h-40" />}
      {!loadingBooths && expos.length === 0 && (
        <EmptyState icon={Store} title="Reserve a booth to meet your neighbours" text="Neighbour discovery opens once you hold a reserved or confirmed booth at an expo."
          action={<Button to="/exhibitor/booths" onClick={onClose}>Choose a booth</Button>} />
      )}
      {expos.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            {expos.length > 1 && <Select label="Expo" value={expoId} onChange={(e) => setChosen(e.target.value)} options={expos.map((e) => ({ value: e._id, label: e.title }))} wrapperClassName="min-w-56" />}
            <Chips label="Which exhibitors to show" options={SCOPES} value={scope} onChange={setScope} />
          </div>
          {isLoading && <SkeletonCards n={2} className="h-28" />}
          {error && <ErrorState error={error} onRetry={refetch} />}
          {data?.length === 0 && <EmptyState icon={UsersRound} title="No exhibitors found" text={scope === 'neighbors' ? 'No one is next to your booth yet. Try “All exhibitors”.' : 'No other exhibitors hold a booth at this expo yet.'} />}
          {data?.length > 0 && (
            <ul className="space-y-3">
              {data.map((n) => <NeighborCard key={n.userId} neighbor={n} onMessage={start.mutate} pending={start.isPending && start.variables === n.userId} />)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Adds a message to an open thread and bumps the conversation list, without duplicating it. */
function appendMessage(qc, conversationId, message, { unread = 0 } = {}) {
  qc.setQueryData(threadKey(conversationId), (old) => (old && !old.some((m) => m._id === message._id) ? [...old, message] : old));
  qc.setQueryData(KEYS.conversations, (list) => {
    const current = list?.find((c) => c._id === conversationId);
    if (!current) return list;
    return [{ ...current, lastMessage: message.body.slice(0, 120), lastAt: message.createdAt, unread }, ...list.filter((c) => c._id !== conversationId)];
  });
}

function ThreadPane({ convo, onBack }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const id = convo._id;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: threadKey(id),
    queryFn: async () => {
      const items = await get(`/messages/conversations/${id}`).then((d) => d.items);
      qc.setQueryData(KEYS.conversations, (list) => list?.map((c) => (c._id === id ? { ...c, unread: 0 } : c))); // fetching marks it read
      return items;
    },
  });

  const send = useMutation({
    mutationFn: (body) => post(`/messages/conversations/${id}`, { body }),
    onSuccess: (res) => appendMessage(qc, id, res.data.message),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const messages = useMemo(() => (data || []).map((m) => ({ id: m._id, mine: m.sender === user._id, author: displayName(convo), body: m.body, at: m.createdAt })), [data, convo, user._id]);

  return (
    <>
      <header className="p-3 sm:p-4 border-b border-line flex items-center gap-3">
        <IconButton label="Back to conversations" icon={ArrowLeft} className="lg:hidden" onClick={onBack} />
        <Avatar name={displayName(convo)} src={convo.with.logo} square />
        <div className="min-w-0">
          <h2 className="font-bold truncate">{displayName(convo)}</h2>
          {convo.with.companyName && <p className="text-sm text-muted truncate">{convo.with.name}</p>}
        </div>
      </header>
      {isLoading && <div className="p-5 space-y-3 flex-1"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-12 w-1/2 ml-auto" /><Skeleton className="h-12 w-3/5" /></div>}
      {error && <div className="p-5 flex-1"><ErrorState error={error} onRetry={refetch} /></div>}
      {data && <MessageList messages={messages} label={`Messages with ${displayName(convo)}`} empty={<p className="text-center text-sm text-muted py-10">Say hello to start the conversation.</p>} />}
      <Composer onSend={send.mutateAsync} pending={send.isPending} label={`Message ${displayName(convo)}`} disabled={!data} />
    </>
  );
}

export default function Messages() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [finding, setFinding] = useState(false);
  const [search, setSearch] = useState('');
  const activeId = params.get('c');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: KEYS.conversations, queryFn: () => get('/messages/conversations').then((d) => d.items) });
  const ref = usePageReveal(data);

  const open = (id) => setParams(id ? { c: id } : {}, { replace: true });

  useSocketEvent('message:new', ({ conversationId, message }) => {
    const known = qc.getQueryData(KEYS.conversations)?.find((c) => c._id === conversationId);
    if (!known) { qc.invalidateQueries({ queryKey: KEYS.conversations }); return; }
    const mine = message.sender === user._id;
    const viewing = conversationId === activeId;
    appendMessage(qc, conversationId, message, { unread: mine || viewing ? 0 : known.unread + 1 });
    if (viewing && !mine) qc.invalidateQueries({ queryKey: threadKey(conversationId) }); // refetching marks it read on the server
  });

  const rows = (data || []).filter((c) => displayName(c).toLowerCase().includes(search.trim().toLowerCase()));
  const active = data?.find((c) => c._id === activeId);

  return (
    <div ref={ref}>
      <PageHeader title="Exhibitor messages" subtitle="Chat with neighbouring exhibitors and exchange contact details."
        actions={<Button icon={UsersRound} onClick={() => setFinding(true)}>Find neighbours</Button>} />

      {isLoading && <SkeletonCards n={3} className="h-24" />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:h-[calc(100dvh-13rem)] lg:min-h-[34rem]">
          <Card data-reveal className={cn('flex-col overflow-hidden max-h-[75dvh] lg:max-h-none', active ? 'hidden lg:flex' : 'flex')}>
            <div className="p-3 border-b border-line"><SearchInput value={search} onChange={setSearch} placeholder="Search conversations" /></div>
            {data.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No conversations yet" text="Find exhibitors near your booth and start a chat."
                action={<Button icon={UsersRound} onClick={() => setFinding(true)}>Find neighbours</Button>} />
            ) : rows.length === 0 ? <p className="p-6 text-sm text-muted text-center">No conversations match “{search}”.</p> : (
              <ul className="overflow-y-auto flex-1" aria-label="Conversations">
                {rows.map((c) => <ConversationRow key={c._id} convo={c} active={c._id === activeId} onOpen={open} />)}
              </ul>
            )}
          </Card>
          <Card data-reveal className={cn('flex-col overflow-hidden h-[75dvh] lg:h-auto', active ? 'flex' : 'hidden lg:flex')}>
            {active ? <ThreadPane key={active._id} convo={active} onBack={() => open(null)} />
              : <EmptyState icon={MessageCircle} title="Select a conversation" text="Pick a chat on the left, or find a neighbour to message." className="my-auto"
                action={<Link to="/exhibitor/booths" className="text-sm font-semibold text-primary-text hover:underline">View your booths</Link>} />}
          </Card>
        </div>
      )}

      {finding && <NeighborsModal onClose={() => setFinding(false)} onStarted={(id) => { setFinding(false); open(id); }} />}
    </div>
  );
}
