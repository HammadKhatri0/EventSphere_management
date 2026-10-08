import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BarChart3, CalendarClock, CalendarDays, Eye, EyeOff, Map, MapPin, Pencil, Plus, Ticket, Trash2, Users } from 'lucide-react';
import { del, errorMessage, patch, assetUrl } from '../../lib/api.js';
import { fmtRange } from '../../lib/utils.js';
import { useDebounced, useExpos, useReveal } from '../../hooks/index.js';
import { Badge, Button, Card, Chips, ConfirmModal, EmptyState, ErrorState, IconButton, PageHeader, ProgressBar, SearchInput, SkeletonCards, StatusBadge } from '../../components/ui/index.jsx';

const FILTERS = [['all', 'All'], ['draft', 'Draft'], ['published', 'Published'], ['ongoing', 'Live now'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];

export default function Expos() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useExpos({ mine: true, limit: 100 });
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 200).trim().toLowerCase();
  const [toDelete, setToDelete] = useState(null);
  const cancelDelete = useCallback(() => setToDelete(null), []);

  const expos = data?.items;
  const counts = useMemo(() => (expos || []).reduce((m, e) => ({ ...m, [e.status]: (m[e.status] || 0) + 1 }), { all: expos?.length || 0 }), [expos]);
  const visible = useMemo(() => (expos || []).filter((e) => (status === 'all' || e.status === status)
    && (!q || [e.title, e.theme, e.location?.city, e.location?.venue].some((v) => v?.toLowerCase().includes(q)))), [expos, status, q]);
  const gridRef = useReveal('[data-reveal]', [!!expos, status, q]);

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['expos'] }); qc.invalidateQueries({ queryKey: ['analytics'] }); };
  const toggle = useMutation({
    mutationFn: (e) => patch(`/expos/${e._id}`, { status: e.status === 'draft' ? 'published' : 'draft' }),
    onSuccess: (_r, e) => { toast.success(e.status === 'draft' ? `“${e.title}” is now published` : `“${e.title}” moved back to draft`); invalidate(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (e) => del(`/expos/${e._id}`),
    onSuccess: (_r, e) => { toast.success(`“${e.title}” was deleted`); setToDelete(null); invalidate(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <>
      <PageHeader title="Expo events" subtitle="Create, publish and manage every expo you organize."
        actions={<Button to="/admin/expos/new" icon={Plus}>New expo</Button>} />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by title, theme or city" className="w-full sm:w-80" />
        <Chips label="Filter by status" value={status} onChange={setStatus}
          options={FILTERS.filter(([v]) => v === 'all' || counts[v]).map(([value, label]) => ({ value, label: `${label} (${counts[value] || 0})` }))} />
      </div>

      {isLoading ? <SkeletonCards n={6} className="h-72" /> : isError ? <ErrorState error={error} onRetry={refetch} />
        : !expos.length ? (
          <Card><EmptyState icon={Ticket} title="No expos yet" text="Create your first expo to start building a floor plan and accepting exhibitor applications."
            action={<Button to="/admin/expos/new" icon={Plus}>Create expo</Button>} /></Card>
        ) : !visible.length ? (
          <Card><EmptyState title="No expos match your filters" text="Try a different search term or status."
            action={<Button variant="secondary" onClick={() => { setSearch(''); setStatus('all'); }}>Clear filters</Button>} /></Card>
        ) : (
          <ul ref={gridRef} className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
            {visible.map((e) => <ExpoCard key={e._id} expo={e} onToggle={() => toggle.mutate(e)} toggling={toggle.isPending && toggle.variables?._id === e._id} onDelete={() => setToDelete(e)} />)}
          </ul>
        )}

      <ConfirmModal open={!!toDelete} onClose={cancelDelete} loading={remove.isPending}
        title={`Delete “${toDelete?.title}”?`} confirmText="Delete expo and all data" onConfirm={() => remove.mutate(toDelete)}
        message="This permanently removes the expo together with its booths, sessions, exhibitor applications, attendee registrations, inquiries and analytics. Support tickets are kept but unlinked. This cannot be undone." />
    </>
  );
}

function ExpoCard({ expo, onToggle, toggling, onDelete }) {
  const s = expo.stats || {};
  const taken = (s.booked || 0) + (s.reserved || 0);
  const occupancy = s.booths ? Math.round((taken / s.booths) * 100) : 0;
  const canToggle = ['draft', 'published'].includes(expo.status);
  const where = [expo.location?.venue, expo.location?.city].filter(Boolean).join(', ');
  return (
    <li data-reveal className="card overflow-hidden flex flex-col">
      <div className="relative h-36 bg-primary-soft">
        {expo.banner ? <img src={assetUrl(expo.banner)} alt="" loading="lazy" className="size-full object-cover" />
          : <div className="size-full grid place-items-center text-primary-text"><Ticket className="size-10 opacity-60" aria-hidden /></div>}
        <div className="absolute top-3 left-3 flex gap-2">
          <StatusBadge status={expo.status} />
          {expo.featured && <Badge tone="info">Featured</Badge>}
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-snug">{expo.title}</h2>
          {expo.theme && <p className="text-sm text-muted truncate">{expo.theme}</p>}
          <p className="mt-2 flex items-center gap-2 text-sm text-muted"><CalendarDays className="size-4 shrink-0" aria-hidden />{fmtRange(expo.startDate, expo.endDate)}</p>
          {where && <p className="mt-1 flex items-center gap-2 text-sm text-muted"><MapPin className="size-4 shrink-0" aria-hidden /><span className="truncate">{where}</span></p>}
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-semibold">{taken}/{s.booths || 0} booths taken</span>
            <span className="text-muted tabular-nums">{occupancy}%</span>
          </div>
          <ProgressBar value={occupancy} label={`Booth occupancy for ${expo.title}`} tone={occupancy >= 90 ? 'warning' : 'primary'} />
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted"><Users className="size-4" aria-hidden />{s.attendees || 0} registered attendees</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <Button to={`/admin/expos/${expo._id}/edit`} size="sm" variant="soft" icon={Pencil}>Edit</Button>
          <Link to={`/admin/floor-plan?expo=${expo._id}`} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] font-semibold text-muted hover:text-fg hover:bg-surface-2"><Map className="size-4" aria-hidden />Floor plan</Link>
          <Link to={`/admin/schedule?expo=${expo._id}`} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] font-semibold text-muted hover:text-fg hover:bg-surface-2"><CalendarClock className="size-4" aria-hidden />Schedule</Link>
          <Link to={`/admin/analytics?expo=${expo._id}`} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] font-semibold text-muted hover:text-fg hover:bg-surface-2"><BarChart3 className="size-4" aria-hidden />Analytics</Link>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-3 -mb-1">
          {canToggle ? (
            <Button size="sm" variant="secondary" loading={toggling} icon={expo.status === 'draft' ? Eye : EyeOff} onClick={onToggle}>
              {expo.status === 'draft' ? 'Publish' : 'Unpublish'}
            </Button>
          ) : <span />}
          <IconButton label={`Delete ${expo.title}`} icon={Trash2} className="hover:text-danger" onClick={onDelete} />
        </div>
      </div>
    </li>
  );
}
