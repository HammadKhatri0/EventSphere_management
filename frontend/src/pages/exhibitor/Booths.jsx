import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardCheck, MousePointerClick, Store, Ticket } from 'lucide-react';
import FloorPlan from '../../components/FloorPlan.jsx';
import {
  Alert, Button, Card, Chips, ConfirmModal, EmptyState, ErrorState, PageHeader, Select, SkeletonCards, Skeleton, StatusBadge,
} from '../../components/ui/index.jsx';
import { useLiveBooths } from '../../hooks/index.js';
import { errorMessage, post } from '../../lib/api.js';
import { gsap, prefersReducedMotion, useGSAP } from '../../lib/motion.js';
import { fmtMoney } from '../../lib/utils.js';
import { AvailableList, BoothFacts, MyBoothCard } from './BoothParts.jsx';
import { KEYS, useMeta, useMyApplications, useMyBooths, usePageReveal, useSocketEvents } from './shared.js';

const SIZE_FILTERS = [{ value: 'all', label: 'All sizes' }, { value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }];
const SORTS = [{ value: 'asc', label: 'Lowest price first' }, { value: 'desc', label: 'Highest price first' }];
const DEFAULT_MAX_BOOTHS = 2;

function Counter({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2 text-center min-w-0">
      <p className={`text-xl font-extrabold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-muted font-semibold truncate">{label}</p>
    </div>
  );
}

/** Details of the selected booth with the reserve action. Animates in whenever the selection changes. */
function SelectedBoothPanel({ booth, held, max, reserving, onReserve }) {
  const ref = useRef(null);
  useGSAP(() => {
    if (!booth || prefersReducedMotion()) return;
    gsap.fromTo(ref.current, { opacity: 0.2, y: 14, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, clearProps: 'transform,opacity' });
  }, { scope: ref, dependencies: [booth?._id] });

  if (!booth) {
    return (
      <div className="text-center py-6">
        <div className="size-12 mx-auto rounded-2xl bg-primary-soft text-primary-text grid place-items-center mb-3"><MousePointerClick className="size-6" aria-hidden /></div>
        <p className="font-bold">Pick a booth</p>
        <p className="text-sm text-muted mt-1">Select a green booth on the floor plan, or choose one from the list below.</p>
      </div>
    );
  }

  const mine = booth.mine && booth.status !== 'available';
  const atLimit = held >= max;
  return (
    <div ref={ref} className="space-y-4" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted font-semibold">Selected booth</p>
          <p className="text-4xl font-extrabold tracking-tight leading-tight">{booth.code}</p>
        </div>
        <StatusBadge status={booth.status} />
      </div>
      <BoothFacts booth={booth} />
      <div className="flex items-baseline justify-between rounded-xl border border-line px-4 py-3">
        <span className="text-sm text-muted font-semibold">Booth price</span>
        <span className="text-2xl font-extrabold tabular-nums">{fmtMoney(booth.price)}</span>
      </div>
      {mine ? (
        <Alert tone="success" title="This is your booth">
          {booth.status === 'reserved' ? 'It is waiting for the organizer to confirm it.' : 'The organizer has confirmed it.'} Manage it under My booths below.
        </Alert>
      ) : (
        <>
          <Button className="w-full" size="lg" icon={Store} loading={reserving} disabled={atLimit} onClick={onReserve}>Reserve this booth</Button>
          <p className="text-[13px] text-muted">
            {atLimit ? `You already hold the maximum of ${max} booths at this expo. Release one to pick another.`
              : 'Reserving puts the booth on hold as Pending Approval until the organizer confirms it.'}
          </p>
        </>
      )}
    </div>
  );
}

export default function Booths() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const applications = useMyApplications();
  const myBooths = useMyBooths();
  // organizer actions (confirm / release / assign) change my booths: keep that list live too
  useSocketEvents(['booth:updated', 'booths:reload'], () => qc.invalidateQueries({ queryKey: KEYS.myBooths }));
  const { data: meta } = useMeta();
  const [selectedId, setSelectedId] = useState(null);
  const [size, setSize] = useState('all');
  const [sort, setSort] = useState('asc');
  const [confirming, setConfirming] = useState(false);
  const reservingId = useRef(null);
  const panelRef = useRef(null);

  const approved = useMemo(() => (applications.data || []).filter((a) => a.status === 'approved'), [applications.data]);
  const requested = params.get('expo');
  const expoId = approved.find((a) => a.expo._id === requested)?.expo._id || approved[0]?.expo._id;
  const expo = approved.find((a) => a.expo._id === expoId)?.expo;

  const live = useLiveBooths(expoId);
  const booths = live.data?.booths;
  const ref = usePageReveal(booths);

  const selected = booths?.find((b) => b._id === selectedId);
  const held = (booths || []).filter((b) => b.mine && ['reserved', 'booked'].includes(b.status)).length;
  const max = meta?.maxBoothsPerExhibitor ?? DEFAULT_MAX_BOOTHS;

  // Non-matching available booths are hidden; taken ones stay so the plan keeps its context.
  const visible = useMemo(() => (booths || []).filter((b) => b.status !== 'available' || size === 'all' || b.size === size), [booths, size]);
  const available = useMemo(
    () => visible.filter((b) => b.status === 'available').sort((a, b) => (sort === 'asc' ? a.price - b.price : b.price - a.price)),
    [visible, sort]
  );
  const counts = useMemo(() => (booths || []).reduce((m, b) => ({ ...m, [b.status]: (m[b.status] || 0) + 1 }), {}), [booths]);

  // A booth someone else grabbed (or the organizer removed) while it was selected: tell the user and clear the selection.
  useEffect(() => {
    if (!selectedId || !booths || reservingId.current === selectedId) return;
    const b = booths.find((x) => x._id === selectedId);
    if (b && (b.status === 'available' || b.mine)) return;
    toast.warning(b ? `Booth ${b.code} was just taken by another exhibitor. Please choose a different booth.` : 'The selected booth is no longer on the floor plan.');
    setSelectedId(null);
    setConfirming(false);
  }, [booths, selectedId]);

  const chooseExpo = (id) => {
    setSelectedId(null);
    setParams({ expo: id }, { replace: true });
  };

  const chooseSize = (value) => {
    setSize(value);
    if (selected && selected.status === 'available' && value !== 'all' && selected.size !== value) setSelectedId(null);
  };

  const select = (b) => {
    setSelectedId((current) => (current === b._id ? null : b._id));
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' }));
    }
  };

  const reserve = useMutation({
    mutationFn: (booth) => { reservingId.current = booth._id; return post(`/expos/${expoId}/booths/${booth._id}/reserve`); },
    onSuccess: (_res, booth) => {
      toast.success(`Booth ${booth.code} reserved. It is now Pending Approval until the organizer confirms it.`, { duration: 7000 });
      setSelectedId(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      if (err?.response?.status === 409) setSelectedId(null);
    },
    onSettled: () => {
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ['booths', expoId] });
      qc.invalidateQueries({ queryKey: KEYS.myBooths });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
      qc.invalidateQueries({ queryKey: ['expos'] });
      reservingId.current = null;
    },
  });

  const header = <PageHeader title="Booth selection" subtitle="Choose your spot on the live floor plan. Reservations update instantly for everyone." />;

  const myBoothsSection = (
    <section className="mt-10" aria-labelledby="my-booths-title" id="my-booths">
      <h2 id="my-booths-title" className="text-lg font-bold mb-4">My booths</h2>
      {myBooths.isLoading && <SkeletonCards n={2} className="h-64" />}
      {myBooths.error && <ErrorState error={myBooths.error} onRetry={myBooths.refetch} />}
      {myBooths.data?.length === 0 && <Card><EmptyState icon={Store} title="No booths yet" text="Reserve a booth on the floor plan above and it will appear here." /></Card>}
      {myBooths.data?.length > 0 && <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{myBooths.data.map((b) => <MyBoothCard key={b._id} booth={b} />)}</div>}
    </section>
  );

  if (applications.isLoading) return <>{header}<Skeleton className="h-[28rem]" /></>;
  if (applications.error) return <>{header}<ErrorState error={applications.error} onRetry={applications.refetch} /></>;
  if (!approved.length) {
    return (
      <>
        {header}
        <Card>
          <EmptyState icon={ClipboardCheck} title="No approved applications yet" text="You can reserve a booth as soon as an organizer approves your application."
            action={<div className="flex flex-wrap justify-center gap-2"><Button to="/exhibitor/applications" variant="secondary">My applications</Button><Button to="/exhibitor/expos" icon={Ticket}>Find expos</Button></div>} />
        </Card>
        {myBooths.data?.length > 0 && myBoothsSection}
      </>
    );
  }

  return (
    <div ref={ref}>
      {header}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card data-reveal className="p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <Select label="Expo" value={expoId} onChange={(e) => chooseExpo(e.target.value)} wrapperClassName="min-w-56" options={approved.map((a) => ({ value: a.expo._id, label: a.expo.title }))} />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Booth size</p>
              <Chips label="Filter booths by size" options={SIZE_FILTERS} value={size} onChange={chooseSize} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-4" role="group" aria-label="Booth availability">
            <Counter label="Available" value={counts.available || 0} tone="text-success-text" />
            <Counter label="Pending" value={counts.reserved || 0} tone="text-warning-text" />
            <Counter label="Confirmed" value={counts.booked || 0} tone="text-danger-text" />
            <Counter label="Yours" value={held} tone="text-primary-text" />
          </div>

          {live.isLoading && <Skeleton className="h-96" />}
          {live.error && <ErrorState error={live.error} onRetry={live.refetch} />}
          {booths?.length === 0 && <EmptyState icon={Store} title="No booths on this floor plan yet" text={`${expo?.title} has no booths published. The organizer is still setting up the floor plan.`} />}
          {booths?.length > 0 && (
            <FloorPlan floorPlan={live.data.floorPlan} booths={visible} mode="select" selectedId={selectedId} onSelect={select} showPrice label={`${expo?.title} floor plan`} />
          )}
        </Card>

        <aside ref={panelRef} aria-label="Selected booth" className="lg:sticky lg:top-24 lg:self-start space-y-6">
          <Card data-reveal className="p-5">
            <SelectedBoothPanel booth={selected} held={held} max={max} reserving={reserve.isPending} onReserve={() => setConfirming(true)} />
          </Card>
          {booths?.length > 0 && (
            <Card data-reveal className="p-5 space-y-3">
              <h2 className="text-base font-bold">Available booths <span className="text-muted font-medium">({available.length})</span></h2>
              <Chips label="Sort available booths" options={SORTS} value={sort} onChange={setSort} />
              {available.length > 0 && (
                <p className="text-[13px] text-muted flex items-center gap-1.5"><CheckCircle2 className="size-4 text-success" aria-hidden />
                  {fmtMoney(Math.min(...available.map((b) => b.price)))} – {fmtMoney(Math.max(...available.map((b) => b.price)))}
                </p>
              )}
              <AvailableList booths={available} selectedId={selectedId} onSelect={select} />
            </Card>
          )}
        </aside>
      </div>

      {myBoothsSection}

      <ConfirmModal open={confirming && !!selected} onClose={() => setConfirming(false)} tone="primary" loading={reserve.isPending} confirmText="Reserve booth"
        title={`Reserve booth ${selected?.code}?`} message={`You are reserving booth ${selected?.code} (${selected ? fmtMoney(selected.price) : ''}). It will show as Pending Approval until the organizer confirms it. You can release it any time before then.`}
        onConfirm={() => reserve.mutate(selected)} />
    </div>
  );
}
