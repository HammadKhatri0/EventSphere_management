import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { del, errorMessage, get, patch, post } from '../../lib/api.js';
import { cn, timeAgo } from '../../lib/utils.js';
import { Button, Card, Chips, EmptyState, ErrorState, IconButton, PageHeader, Pagination, SkeletonCards } from '../../components/ui/index.jsx';

export default function Notifications() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', 'page', page, filter],
    queryFn: () => get('/notifications', { page, limit: 15, unread: filter === 'unread' || undefined }),
    placeholderData: (prev) => prev,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const readAll = useMutation({ mutationFn: () => post('/notifications/read-all'), onSuccess: refresh });
  const markRead = useMutation({ mutationFn: (id) => patch(`/notifications/${id}/read`), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id) => del(`/notifications/${id}`), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });

  return (
    <>
      <PageHeader title="Notifications" subtitle="Reminders, approvals, messages and schedule changes." actions={<Button variant="secondary" icon={CheckCheck} onClick={() => readAll.mutate()} disabled={!data?.unreadCount}>Mark all as read</Button>} />
      <div className="mb-4"><Chips label="Filter notifications" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: `Unread${data?.unreadCount ? ` (${data.unreadCount})` : ''}` }]} /></div>
      {isLoading ? <SkeletonCards n={3} className="h-20" /> : error ? <ErrorState error={error} onRetry={refetch} /> : !data.items.length ? (
        <Card><EmptyState icon={Bell} title="Nothing here yet" text="We’ll let you know when something needs your attention." /></Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {data.items.map((n) => (
            <div key={n._id} data-reveal className={cn('flex items-start gap-3 p-4', !n.read && 'bg-primary-soft/40')}>
              <span className={cn('mt-2 size-2 rounded-full shrink-0', n.read ? 'bg-line' : 'bg-primary')} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="text-sm text-muted">{n.body}</p>}
                <p className="text-xs text-muted mt-1">{timeAgo(n.createdAt)}</p>
                {n.link && <Link to={n.link} onClick={() => !n.read && markRead.mutate(n._id)} className="text-sm font-semibold text-primary-text hover:underline mt-1 inline-block">Open</Link>}
              </div>
              {!n.read && <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n._id)}>Mark read</Button>}
              <IconButton label="Delete notification" icon={Trash2} onClick={() => remove.mutate(n._id)} />
            </div>
          ))}
        </Card>
      )}
      <Pagination pagination={data?.pagination} onPage={setPage} />
    </>
  );
}
