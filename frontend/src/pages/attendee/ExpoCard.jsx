import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, MapPin, Store } from 'lucide-react';
import { Badge, StatusBadge } from '../../components/ui/index.jsx';
import { assetUrl } from '../../lib/api.js';
import { cn, fmtNumber, fmtRange } from '../../lib/utils.js';
import { expoBadgeProps } from './attendeeShared.js';

export const ExpoBanner = ({ expo, className }) => (
  expo.banner
    ? <img src={assetUrl(expo.banner)} alt="" loading="lazy" className={cn('w-full object-cover', className)} />
    : <div aria-hidden className={cn('grid place-items-center bg-gradient-to-br from-primary to-info text-white', className)}><CalendarDays className="size-10 opacity-70" /></div>
);

export const venueLine = (expo) => [expo.location?.venue, expo.location?.city].filter(Boolean).join(', ');

/** Browsable expo summary; the whole card links to the expo page. */
export default function ExpoCard({ expo, registered }) {
  const exhibitors = expo.stats?.booked;
  return (
    <article data-item className="card relative overflow-hidden flex flex-col transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative">
        <ExpoBanner expo={expo} className="h-36" />
        <div className="absolute top-3 left-3 flex gap-2">
          <StatusBadge {...expoBadgeProps(expo)} className="shadow-sm" />
          {expo.featured && <Badge tone="warning" className="shadow-sm">Featured</Badge>}
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-bold leading-snug">
            <Link to={`/attendee/expos/${expo._id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-2xl">{expo.title}</Link>
          </h3>
          {expo.theme && <p className="text-sm text-muted mt-0.5 line-clamp-1">{expo.theme}</p>}
        </div>
        <ul className="space-y-1.5 text-sm text-muted">
          <li className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0" aria-hidden />{fmtRange(expo.startDate, expo.endDate)}</li>
          <li className="flex items-center gap-2"><MapPin className="size-4 shrink-0" aria-hidden /><span className="truncate">{venueLine(expo) || 'Venue to be announced'}</span></li>
          {exhibitors > 0 && <li className="flex items-center gap-2"><Store className="size-4 shrink-0" aria-hidden />{fmtNumber(exhibitors)} {exhibitors === 1 ? 'exhibitor' : 'exhibitors'}</li>}
        </ul>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {registered && <Badge tone="success" icon={CheckCircle2}>Registered</Badge>}
          {(expo.categories || []).slice(0, 3).map((c) => <Badge key={c}>{c}</Badge>)}
        </div>
      </div>
    </article>
  );
}
