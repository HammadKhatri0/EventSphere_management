import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquareHeart, Star } from 'lucide-react';
import { errorMessage, get, patch } from '../../lib/api.js';
import { fmtDateTime, ROLE_LABEL } from '../../lib/utils.js';
import { useReveal } from '../../hooks/index.js';
import { Badge, Card, DataTable, EmptyState, ErrorState, PageHeader, Pagination, Select, Skeleton } from '../../components/ui/index.jsx';

const TYPE_OPTIONS = [{ value: 'suggestion', label: 'Suggestion' }, { value: 'issue', label: 'Issue' }, { value: 'other', label: 'Other' }];
const STATUS_OPTIONS = [{ value: 'new', label: 'New' }, { value: 'reviewed', label: 'Reviewed' }, { value: 'resolved', label: 'Resolved' }];
const TYPE_TONE = { suggestion: 'info', issue: 'danger', other: 'neutral' };

function Stars({ rating }) {
  if (!rating) return <span className="text-muted">No rating</span>;
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} aria-hidden className={`size-4 ${n <= rating ? 'fill-warning text-warning' : 'text-line'}`} />)}
      <span className="sr-only">{rating} out of 5 stars</span>
    </span>
  );
}

export default function FeedbackAdmin() {
  const qc = useQueryClient();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [type, status]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['feedback', { type, status, page }],
    queryFn: () => get('/feedback', { type: type || undefined, status: status || undefined, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });
  const update = useMutation({
    mutationFn: ({ id, value }) => patch(`/feedback/${id}`, { status: value }),
    onSuccess: () => { toast.success('Feedback status updated'); qc.invalidateQueries({ queryKey: ['feedback'] }); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const ref = useReveal('[data-reveal]', [!!data]);

  const columns = [
    { key: 'user', header: 'From', render: (f) => <div className="min-w-40"><p className="font-semibold">{f.user?.name || 'Deleted user'}</p><p className="text-[13px] text-muted">{f.user?.email}</p>{f.user?.role && <p className="text-[13px] text-muted">{ROLE_LABEL[f.user.role]}</p>}</div> },
    { key: 'type', header: 'Type', render: (f) => <Badge tone={TYPE_TONE[f.type]}>{f.type[0].toUpperCase() + f.type.slice(1)}</Badge> },
    { key: 'rating', header: 'Rating', render: (f) => <Stars rating={f.rating} /> },
    { key: 'message', header: 'Message', className: 'min-w-72 max-w-md', render: (f) => <p className="whitespace-pre-line break-words">{f.message}</p> },
    { key: 'date', header: 'Received', render: (f) => <span className="whitespace-nowrap">{fmtDateTime(f.createdAt)}</span> },
    {
      key: 'status', header: 'Status', render: (f) => (
        <Select aria-label={`Status of feedback from ${f.user?.name || 'deleted user'}`} value={f.status} options={STATUS_OPTIONS} className="h-9 w-36"
          disabled={update.isPending && update.variables?.id === f._id} onChange={(e) => update.mutate({ id: f._id, value: e.target.value })} />
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Feedback" subtitle="Suggestions and issue reports from everyone using EventSphere." />
      <Card className="mb-5 p-4 grid gap-3 sm:grid-cols-2 sm:max-w-xl">
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value)} placeholder="All types" options={TYPE_OPTIONS} />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={STATUS_OPTIONS} />
      </Card>

      <div ref={ref}>
        {isLoading ? <Skeleton className="h-80" /> : isError ? <ErrorState error={error} onRetry={refetch} /> : (
          <Card data-reveal className="overflow-hidden">
            <DataTable columns={columns} rows={data.items} caption="User feedback"
              empty={<EmptyState icon={MessageSquareHeart} title="No feedback found" text={type || status ? 'Try clearing the filters.' : 'Feedback submitted by users shows up here.'} />} />
            <div className="px-4 pb-4"><Pagination pagination={data.pagination} onPage={setPage} /></div>
          </Card>
        )}
      </div>
    </>
  );
}
