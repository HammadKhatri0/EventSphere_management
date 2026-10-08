import { useMemo, useRef, useState } from 'react';
import { Map as MapIcon, MousePointerClick, Search, X } from 'lucide-react';
import { Avatar, Button, Card, EmptyState, ErrorState, IconButton, PageHeader, Skeleton } from '../../components/ui/index.jsx';
import FloorPlan from '../../components/FloorPlan.jsx';
import { prefersReducedMotion } from '../../lib/motion.js';
import { useLiveBooths, useReveal } from '../../hooks/index.js';
import BoothDetails from './BoothDetails.jsx';
import ExpoSelect from './ExpoSelect.jsx';
import { useExpoChoice } from './attendeeShared.js';

const MAX_RESULTS = 8;

function BoothSearch({ booths, onPick }) {
  const [text, setText] = useState('');
  const term = text.trim().toLowerCase();
  const results = useMemo(() => (term
    ? booths.filter((b) => b.code.toLowerCase().includes(term) || b.exhibitor?.companyName?.toLowerCase().includes(term)).slice(0, MAX_RESULTS)
    : []), [booths, term]);
  return (
    <div className="space-y-2">
      <label htmlFor="booth-search" className="block text-sm font-semibold">Find an exhibitor or booth</label>
      <div className="relative">
        <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden />
        <input id="booth-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Company name or booth code, e.g. A12"
          className="w-full h-11 rounded-xl border border-line bg-surface pl-10 pr-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
      </div>
      <p role="status" aria-live="polite" className="text-[13px] text-muted min-h-5">{term ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : ''}</p>
      {results.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden">
          {results.map((b) => (
            <li key={b._id}>
              <button type="button" onClick={() => { onPick(b); setText(''); }} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-surface-2">
                <Avatar name={b.exhibitor?.companyName || b.code} src={b.exhibitor?.logo} size="sm" square />
                <span className="min-w-0 flex-1"><span className="block font-semibold truncate">{b.exhibitor?.companyName || `Booth ${b.code}`}</span><span className="block text-[13px] text-muted">Booth {b.code}{b.zone && ` · ${b.zone}`}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Directory({ booths, selectedId, onPick }) {
  const listed = useMemo(() => booths.filter((b) => b.status === 'booked' && b.exhibitor?.companyName)
    .sort((a, b) => a.exhibitor.companyName.localeCompare(b.exhibitor.companyName)), [booths]);
  const ref = useReveal('[data-item]', [listed.length]);
  return (
    <section ref={ref} aria-labelledby="directory-title" className="mt-8">
      <h2 id="directory-title" className="text-xl font-bold">Exhibitor directory</h2>
      <p className="text-sm text-muted mb-4">The same information as the map, as a list.</p>
      {listed.length === 0 ? <Card><EmptyState title="No confirmed exhibitors yet" text="Exhibitors appear here once their booths are confirmed." /></Card> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listed.map((b) => (
            <li key={b._id} data-item className="card p-4 flex items-center gap-3">
              <Avatar name={b.exhibitor.companyName} src={b.exhibitor.logo} square />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{b.exhibitor.companyName}</p>
                <p className="text-[13px] text-muted truncate">Booth {b.code}{b.zone && ` · ${b.zone}`}</p>
              </div>
              <Button size="sm" variant={selectedId === b._id ? 'soft' : 'secondary'} aria-pressed={selectedId === b._id} onClick={() => onPick(b)}>Show on map</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function FloorPlanViewer() {
  const { expos, expo, expoId, setExpoId, params, setParams, query: exposQuery } = useExpoChoice();
  const plan = useLiveBooths(expoId);
  const mapRef = useRef(null);
  const booths = useMemo(() => plan.data?.booths || [], [plan.data]);
  const selected = booths.find((b) => b._id === params.get('booth')) || null;

  const pick = (b) => {
    setParams({ booth: b._id });
    mapRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <>
      <PageHeader title="Floor plan" subtitle="Find booths, see who is exhibiting where and plan your route." />

      <section data-reveal aria-label="Floor plan filters" className="card p-4 sm:p-5 mb-6 grid gap-4 md:grid-cols-2 md:items-start">
        <ExpoSelect expos={expos} value={expoId} onChange={setExpoId} />
        <BoothSearch booths={booths} onPick={pick} />
      </section>

      {exposQuery.isLoading || (expoId && plan.isLoading) ? <Skeleton className="h-[28rem]" />
        : exposQuery.isError ? <ErrorState error={exposQuery.error} onRetry={exposQuery.refetch} />
        : plan.isError ? <ErrorState error={plan.error} onRetry={plan.refetch} />
        : !expo ? <EmptyState icon={MapIcon} title="No expos available" text="Floor plans appear once an expo is published." />
        : !booths.length ? <Card><EmptyState icon={MapIcon} title="Floor plan not ready" text="The organizer has not laid out any booths for this expo yet." /></Card>
        : (
          <div ref={mapRef} className="grid gap-6 lg:grid-cols-[1fr_340px] items-start scroll-mt-24">
            <Card data-reveal className="p-4 sm:p-5 min-w-0">
              <FloorPlan mode="view" floorPlan={plan.data.floorPlan} booths={booths} selectedId={selected?._id} highlightId={selected?._id} showPrice={false} onSelect={pick}
                label={`Floor plan of ${expo.title}`} />
            </Card>
            <Card as="aside" data-reveal aria-label="Booth details" className="p-5 lg:sticky lg:top-24" aria-live="polite">
              {selected ? (
                <>
                  <div className="flex justify-end -mt-1 -mr-1"><IconButton label="Clear selection" icon={X} onClick={() => setParams({ booth: '' })} /></div>
                  <BoothDetails key={selected._id} booth={selected} expoId={expoId} />
                </>
              ) : <EmptyState icon={MousePointerClick} title="Select a booth" text="Click a booth on the map, or search above, to see who is there." className="py-8" />}
            </Card>
          </div>
        )}

      {booths.length > 0 && <Directory booths={booths} selectedId={selected?._id} onPick={pick} />}
    </>
  );
}
