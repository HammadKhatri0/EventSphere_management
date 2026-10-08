import { MapPin, MessageSquare, Package, UserRound } from 'lucide-react';
import { Avatar, Badge, Button, StatusBadge } from '../../components/ui/index.jsx';
import { useBoothVisit } from './attendeeShared.js';

/** Booth summary with exhibitor showcase. Records a visit once per booth while mounted. */
export default function BoothDetails({ booth, expoId }) {
  useBoothVisit(expoId, booth._id);
  const ex = booth.exhibitor;
  const showcase = booth.showcase;
  const tagline = showcase?.tagline || ex?.tagline;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-extrabold">Booth {booth.code}</h3>
        <StatusBadge status={booth.status} />
      </div>
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <MapPin className="size-4" aria-hidden />{[booth.zone, `${booth.size} (${booth.w}×${booth.h})`].filter(Boolean).join(' · ')}
      </p>

      {ex?.companyName ? (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3">
            <Avatar name={ex.companyName} src={ex.logo} size="lg" square />
            <div className="min-w-0">
              <p className="font-bold leading-snug">{ex.companyName}</p>
              {tagline && <p className="text-sm text-muted">{tagline}</p>}
            </div>
          </div>
          {showcase?.description && <p className="text-sm">{showcase.description}</p>}
          {showcase?.products?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-muted mb-1.5 flex items-center gap-1.5"><Package className="size-3.5" aria-hidden />Showcasing</p>
              <ul className="flex flex-wrap gap-1.5">{showcase.products.map((p) => <li key={p}><Badge tone="info">{p}</Badge></li>)}</ul>
            </div>
          )}
          {ex.categories?.length > 0 && <ul className="flex flex-wrap gap-1.5" aria-label="Categories">{ex.categories.map((c) => <li key={c}><Badge tone="primary">{c}</Badge></li>)}</ul>}
          {ex.profileId && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button to={`/attendee/exhibitors/${ex.profileId}`} icon={UserRound}>View exhibitor profile</Button>
              <Button to={`/attendee/exhibitors/${ex.profileId}#inquiry`} variant="secondary" icon={MessageSquare}>Send inquiry</Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">
          {booth.status === 'available' && 'This booth is still open. Exhibitors can reserve it from their portal.'}
          {booth.status === 'reserved' && 'This booth has been reserved and is awaiting organizer approval.'}
          {booth.status === 'blocked' && 'This space is not available for exhibitors.'}
          {booth.status === 'booked' && 'An exhibitor is confirmed for this booth. Details will be published soon.'}
        </p>
      )}
    </div>
  );
}
