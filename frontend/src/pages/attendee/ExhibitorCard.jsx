import { Link } from 'react-router-dom';
import { MapPin, Package } from 'lucide-react';
import { Avatar, Badge } from '../../components/ui/index.jsx';

export const locateUrl = (expoId, boothId) => `/attendee/floor-plan?expo=${expoId}&booth=${boothId}`;

/**
 * Directory entry. `expoId` limits the booth list to one expo; the whole card links to the profile
 * (stretched link) while the "Locate" links sit above it.
 */
export default function ExhibitorCard({ exhibitor, expoId, compact = false }) {
  const booths = expoId ? exhibitor.booths.filter((b) => String(b.expo) === String(expoId)) : exhibitor.booths;
  const shownBooths = booths.length ? booths : exhibitor.booths;
  const primary = shownBooths[0];
  return (
    <article data-item className="card relative p-5 flex flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start gap-3">
        <Avatar name={exhibitor.companyName} src={exhibitor.logo} size="lg" square />
        <div className="min-w-0">
          <h3 className="font-bold leading-snug">
            <Link to={`/attendee/exhibitors/${exhibitor._id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-2xl">{exhibitor.companyName}</Link>
          </h3>
          {exhibitor.tagline && <p className="text-sm text-muted line-clamp-2">{exhibitor.tagline}</p>}
        </div>
      </div>

      {!compact && exhibitor.products?.length > 0 && (
        <p className="flex items-start gap-2 text-[13px] text-muted"><Package className="size-4 shrink-0 mt-0.5" aria-hidden /><span className="line-clamp-2">{exhibitor.products.slice(0, 3).join(' · ')}</span></p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(exhibitor.categories || []).slice(0, compact ? 2 : 3).map((c) => <Badge key={c} tone="primary">{c}</Badge>)}
      </div>

      {primary && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[13px] font-semibold flex items-center gap-1.5"><MapPin className="size-4 text-muted" aria-hidden />Booth {shownBooths.map((b) => b.code).join(', ')}</p>
          <Link to={locateUrl(primary.expo, primary._id)} className="relative z-10 text-[13px] font-semibold text-primary-text hover:underline">Locate on floor plan</Link>
        </div>
      )}
    </article>
  );
}
