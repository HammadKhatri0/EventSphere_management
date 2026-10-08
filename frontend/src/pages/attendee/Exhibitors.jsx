import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, SearchX, X } from 'lucide-react';
import { Button, Chips, EmptyState, ErrorState, Input, PageHeader, Pagination, SearchInput, Select, SkeletonCards } from '../../components/ui/index.jsx';
import { get } from '../../lib/api.js';
import { useDebounced, useExpos, useReveal } from '../../hooks/index.js';
import ExhibitorCard from './ExhibitorCard.jsx';
import ExpoSelect from './ExpoSelect.jsx';
import { idsKey, useMeta, useUrlParams } from './attendeeShared.js';

const SORTS = [{ value: 'name', label: 'Name (A–Z)' }, { value: 'recent', label: 'Recently updated' }];
const PAGE_SIZE = 12;

/** Text filter mirrored into the URL after a short pause. */
function useUrlText(name, params, setParams) {
  const [text, setText] = useState(params.get(name) || '');
  const debounced = useDebounced(text);
  useEffect(() => {
    if (debounced !== (params.get(name) || '')) setParams({ [name]: debounced, page: '' });
  }, [debounced]);
  return [text, setText];
}

function ActiveFilters({ filters, onClearAll }) {
  if (!filters.length) return null;
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {filters.map((f) => (
        <li key={f.key}>
          <button type="button" onClick={f.clear} aria-label={`Remove filter ${f.label}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft text-primary-text px-3 py-1 text-[13px] font-semibold hover:brightness-95">
            {f.label}<X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
      <li><Button size="sm" variant="ghost" onClick={onClearAll}>Clear all</Button></li>
    </ul>
  );
}

export default function Exhibitors() {
  const [params, setParams] = useUrlParams();
  const [q, setQ] = useUrlText('q', params, setParams);
  const [product, setProduct] = useUrlText('product', params, setParams);
  const expoId = params.get('expo') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') === 'recent' ? 'recent' : 'name';
  const page = Number(params.get('page')) || 1;

  const expos = useExpos({ limit: 50 });
  const meta = useMeta();
  const filters = { expo: expoId || undefined, q: params.get('q') || undefined, product: params.get('product') || undefined, category: category || undefined, sort, page, limit: PAGE_SIZE };
  const query = useQuery({ queryKey: ['directory', filters], queryFn: () => get('/exhibitors/directory', filters), placeholderData: (prev) => prev });
  const items = query.data?.items || [];
  const total = query.data?.pagination.total ?? 0;
  const ref = useReveal('[data-item]', [idsKey(items)]);

  const expoTitle = expos.data?.items.find((e) => e._id === expoId)?.title;
  const active = [
    expoId && { key: 'expo', label: `Expo: ${expoTitle || 'selected'}`, clear: () => setParams({ expo: '', page: '' }) },
    params.get('q') && { key: 'q', label: `Keyword: ${params.get('q')}`, clear: () => { setQ(''); setParams({ q: '', page: '' }); } },
    params.get('product') && { key: 'product', label: `Product: ${params.get('product')}`, clear: () => { setProduct(''); setParams({ product: '', page: '' }); } },
    category && { key: 'category', label: `Category: ${category}`, clear: () => setParams({ category: '', page: '' }) },
  ].filter(Boolean);
  const clearAll = () => { setQ(''); setProduct(''); setParams({ expo: '', q: '', product: '', category: '', sort: '', page: '' }); };

  return (
    <>
      <PageHeader title="Exhibitors" subtitle="Search companies by name, category or product and plan your visit." />

      <section data-reveal aria-label="Search filters" className="card p-4 sm:p-5 mb-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ExpoSelect expos={expos.data?.items || []} value={expoId} onChange={(v) => setParams({ expo: v, page: '' })} allLabel="All expos" />
          <div className="space-y-1.5">
            <label htmlFor="exhibitor-q" className="block text-sm font-semibold">Keyword</label>
            <SearchInput id="exhibitor-q" value={q} onChange={setQ} placeholder="Company, tagline or description" aria-label="Keyword" />
          </div>
          <Input label="Product or service" icon={Package} value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. sensors, SaaS" />
          <Select label="Sort by" value={sort} onChange={(e) => setParams({ sort: e.target.value === 'name' ? '' : e.target.value, page: '' })} options={SORTS} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Category</p>
          <Chips label="Category" options={[{ value: '', label: 'All categories' }, ...(meta.data?.categories || [])]} value={category} onChange={(v) => setParams({ category: v, page: '' })} />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p role="status" aria-live="polite" className="text-sm font-semibold">{query.data ? `${total} ${total === 1 ? 'exhibitor' : 'exhibitors'} found` : 'Searching…'}</p>
        <ActiveFilters filters={active} onClearAll={clearAll} />
      </div>

      {query.isLoading ? <SkeletonCards n={6} className="h-44" />
        : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} />
        : items.length === 0 ? (
          <EmptyState icon={SearchX} title="No exhibitors match your search" text="Try fewer filters or a broader keyword." action={active.length > 0 && <Button variant="secondary" onClick={clearAll}>Clear all filters</Button>} />
        ) : (
          <div ref={ref}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((e) => <ExhibitorCard key={e._id} exhibitor={e} expoId={expoId} />)}</div>
            <Pagination pagination={query.data.pagination} onPage={(p) => setParams({ page: p > 1 ? p : '' })} />
          </div>
        )}
    </>
  );
}
