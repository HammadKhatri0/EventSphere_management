import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarSearch } from 'lucide-react';
import { Button, Chips, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, SkeletonCards } from '../../components/ui/index.jsx';
import { get } from '../../lib/api.js';
import { useDebounced, useReveal } from '../../hooks/index.js';
import ExpoCard from './ExpoCard.jsx';
import { idsKey, useMyRegistrations, useUrlParams } from './attendeeShared.js';

const WHEN = [{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'all', label: 'All' }];
const WHEN_PARAMS = { upcoming: { upcoming: 'true' }, past: { status: 'completed' }, all: {} };
const PAGE_SIZE = 12;

export default function Expos() {
  const [params, setParams] = useUrlParams();
  const when = WHEN_PARAMS[params.get('when')] ? params.get('when') : 'upcoming';
  const page = Number(params.get('page')) || 1;
  const [text, setText] = useState(params.get('q') || '');
  const q = useDebounced(text);

  useEffect(() => {
    if (q !== (params.get('q') || '')) setParams({ q, page: '' });
  }, [q]);

  const query = useQuery({
    queryKey: ['expos', { when, q: params.get('q') || '', page }],
    queryFn: () => get('/expos', { ...WHEN_PARAMS[when], q: params.get('q') || undefined, page, limit: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });
  const registrations = useMyRegistrations();
  const registeredIds = new Set((registrations.data || []).map((e) => e._id));
  const items = query.data?.items || [];
  const ref = useReveal('[data-item]', [idsKey(items)]);

  return (
    <>
      <PageHeader title="Browse expos" subtitle="Find the next trade show or conference worth your time." />
      <div data-reveal className="card p-4 mb-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <SearchInput value={text} onChange={setText} placeholder="Search by name, theme or city" />
        <Chips label="Show expos" options={WHEN} value={when} onChange={(v) => setParams({ when: v === 'upcoming' ? '' : v, page: '' })} />
      </div>

      <p className="sr-only" aria-live="polite">{query.data ? `${query.data.pagination.total} expos found` : ''}</p>
      {query.isLoading ? <SkeletonCards n={6} className="h-72" />
        : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} />
        : items.length === 0 ? (
          <EmptyState icon={CalendarSearch} title="No expos found" text="Try a different search or switch to another time range."
            action={(text || when !== 'all') && <Button variant="secondary" onClick={() => { setText(''); setParams({ q: '', when: 'all', page: '' }); }}>Show all expos</Button>} />
        ) : (
          <div ref={ref}>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map((e) => <ExpoCard key={e._id} expo={e} registered={registeredIds.has(e._id)} />)}</div>
            <Pagination pagination={query.data.pagination} onPage={(p) => setParams({ page: p > 1 ? p : '' })} />
          </div>
        )}
    </>
  );
}
