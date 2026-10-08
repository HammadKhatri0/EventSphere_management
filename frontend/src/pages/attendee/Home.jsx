import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bookmark, CalendarDays, MapPin, Map as MapIcon, Sparkles } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, StatusBadge } from '../../components/ui/index.jsx';
import { get } from '../../lib/api.js';
import { gsap, useGSAP, prefersReducedMotion } from '../../lib/motion.js';
import { fmtRange } from '../../lib/utils.js';
import { useReveal } from '../../hooks/index.js';
import Countdown from './Countdown.jsx';
import ExhibitorCard from './ExhibitorCard.jsx';
import ExpoCard, { venueLine } from './ExpoCard.jsx';
import RegisterButton from './RegisterButton.jsx';
import SessionCard from './SessionCard.jsx';
import { expoBadgeProps, expoPhase, idsKey, useExpoDetail, useExpoSessions, useMyRegistrations } from './attendeeShared.js';

const SHAPES = [
  { cls: 'top-8 right-[8%] size-24 rounded-3xl bg-primary/15 rotate-12', id: 'a' },
  { cls: 'bottom-10 right-[22%] size-14 rounded-full bg-info/20', id: 'b' },
  { cls: 'top-1/3 right-[3%] size-32 rounded-full border-2 border-primary/25', id: 'c' },
  { cls: 'bottom-6 left-[46%] size-16 rounded-2xl border-2 border-info/30 -rotate-12', id: 'd' },
];

function HeroTitle({ text }) {
  const words = text.split(/\s+/);
  return (
    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight">
      {words.map((w, i) => (
        <span key={`${w}-${i}`}>
          <span className="inline-block overflow-hidden align-bottom pb-1"><span className={`hero-word inline-block ${i === words.length - 1 ? 'text-primary-text' : ''}`}>{w}</span></span>{' '}
        </span>
      ))}
    </h1>
  );
}

function Hero({ expo, detail }) {
  const ref = useRef(null);
  const phase = expo ? expoPhase(expo) : null;

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.from('.hero-kicker', { y: 14, opacity: 0, duration: 0.5 })
      .from('.hero-word', { yPercent: 115, duration: 0.8, stagger: 0.07 }, '-=0.25')
      .from('.hero-fade', { y: 18, opacity: 0, duration: 0.6, stagger: 0.1 }, '-=0.45');
    gsap.to('.hero-shape', { y: 'random(-20, 20)', x: 'random(-14, 14)', rotation: 'random(-14, 14)', duration: 'random(3, 5)', ease: 'sine.inOut', repeat: -1, yoyo: true, stagger: { each: 0.4, from: 'random' } });
  }, { scope: ref, dependencies: [expo?._id] });

  return (
    <section ref={ref} aria-labelledby="hero-title" className="hero-bg relative overflow-hidden rounded-3xl border border-line px-5 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16 mb-8">
      <div aria-hidden className="grid-bg absolute inset-0 opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      {SHAPES.map((s) => <div key={s.id} aria-hidden className={`hero-shape absolute hidden sm:block ${s.cls}`} />)}

      {expo ? (
        <div className="relative max-w-3xl space-y-6">
          <div className="hero-kicker flex flex-wrap items-center gap-2">
            <Badge tone="primary" icon={Sparkles}>{expo.featured ? 'Featured expo' : phase === 'live' ? 'Happening now' : 'Next up'}</Badge>
            <StatusBadge {...expoBadgeProps(expo)} />
          </div>
          <div id="hero-title"><HeroTitle text={expo.title} /></div>
          {expo.theme && <p className="hero-fade text-lg sm:text-xl text-muted max-w-2xl">{expo.theme}</p>}
          <ul className="hero-fade flex flex-wrap gap-2 text-sm font-semibold">
            <li className="flex items-center gap-1.5 rounded-full border border-line bg-surface/80 backdrop-blur px-3.5 py-1.5"><CalendarDays className="size-4 text-primary-text" aria-hidden />{fmtRange(expo.startDate, expo.endDate)}</li>
            {venueLine(expo) && <li className="flex items-center gap-1.5 rounded-full border border-line bg-surface/80 backdrop-blur px-3.5 py-1.5"><MapPin className="size-4 text-primary-text" aria-hidden />{venueLine(expo)}</li>}
          </ul>
          {phase === 'upcoming' && <Countdown target={expo.startDate} />}
          <div className="hero-fade flex flex-wrap gap-3 pt-1">
            {detail ? <RegisterButton expo={detail} /> : <Skeleton className="h-12 w-52" />}
            <Button to={`/attendee/expos/${expo._id}`} size="lg" variant="secondary" icon={ArrowRight}>Explore the expo</Button>
          </div>
        </div>
      ) : (
        <div className="relative max-w-2xl space-y-5">
          <Badge tone="primary" icon={Sparkles}>Welcome to EventSphere</Badge>
          <h1 id="hero-title" className="text-4xl sm:text-5xl font-extrabold leading-tight">Discover the next big expo</h1>
          <p className="text-lg text-muted">No upcoming expo is published yet. Check back soon, or browse past events.</p>
          <Button to="/attendee/expos" size="lg">Browse expos</Button>
        </div>
      )}
    </section>
  );
}

function QuickLinks({ expoId }) {
  const q = expoId ? `?expo=${expoId}` : '';
  const links = [
    { to: `/attendee/floor-plan${q}`, label: 'Floor plan', text: 'Find booths and exhibitors', icon: MapIcon },
    { to: `/attendee/schedule${q}`, label: 'Schedule', text: 'Browse sessions by day', icon: CalendarDays },
    { to: '/attendee/agenda', label: 'My agenda', text: 'Your bookmarks and registrations', icon: Bookmark },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-3 mb-8">
      {links.map(({ to, label, text, icon: Icon }) => (
        <li key={label} data-reveal>
          <Link to={to} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
            <span className="size-12 rounded-2xl bg-primary-soft text-primary-text grid place-items-center shrink-0"><Icon className="size-6" aria-hidden /></span>
            <span className="min-w-0"><span className="block font-bold">{label}</span><span className="block text-sm text-muted">{text}</span></span>
            <ArrowRight className="size-4 ml-auto text-muted shrink-0" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SectionHead({ id, title, subtitle, to, cta }) {
  return (
    <div data-reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <h2 id={id} className="text-xl font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {to && <Link to={to} className="text-sm font-semibold text-primary-text hover:underline inline-flex items-center gap-1">{cta}<ArrowRight className="size-4" aria-hidden /></Link>}
    </div>
  );
}

function UpcomingSessions({ expoId }) {
  const sessions = useExpoSessions(expoId);
  const upcoming = useMemo(() => (sessions.data?.items || []).filter((s) => new Date(s.endTime).getTime() >= Date.now()).slice(0, 5), [sessions.data]);
  const ref = useReveal('[data-item]', [idsKey(upcoming)]);
  return (
    <section ref={ref} aria-labelledby="home-sessions" className="space-y-4">
      <SectionHead id="home-sessions" title="Upcoming sessions" subtitle="Bookmark the talks you don’t want to miss." to={`/attendee/schedule?expo=${expoId}`} cta="Full schedule" />
      {sessions.isLoading ? <Skeleton className="h-40" />
        : sessions.isError ? <ErrorState error={sessions.error} onRetry={sessions.refetch} />
        : upcoming.length ? upcoming.map((s) => <SessionCard key={s._id} session={s} compact />)
        : <Card><EmptyState icon={CalendarDays} title="No upcoming sessions" text="The schedule for this expo has not been published yet." /></Card>}
    </section>
  );
}

function FeaturedExhibitors({ expoId }) {
  const query = useQuery({ queryKey: ['directory', { expo: expoId, limit: 6 }], queryFn: () => get('/exhibitors/directory', { expo: expoId, limit: 6 }) });
  const items = query.data?.items || [];
  const ref = useReveal('[data-item]', [idsKey(items)]);
  return (
    <section ref={ref} aria-labelledby="home-exhibitors" className="space-y-4">
      <SectionHead id="home-exhibitors" title="Featured exhibitors" subtitle="Companies showing off their latest at this expo." to={`/attendee/exhibitors?expo=${expoId}`} cta="All exhibitors" />
      {query.isLoading ? <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
        : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} />
        : items.length ? <div className="grid gap-4 sm:grid-cols-2">{items.map((e) => <ExhibitorCard key={e._id} exhibitor={e} expoId={expoId} compact />)}</div>
        : <Card><EmptyState title="Exhibitors coming soon" text="Confirmed exhibitors will appear here once booths are approved." /></Card>}
    </section>
  );
}

export default function Home() {
  const expos = useQuery({ queryKey: ['expos', { upcoming: true, limit: 6 }], queryFn: () => get('/expos', { upcoming: 'true', limit: 6 }) });
  const registrations = useMyRegistrations();
  const items = expos.data?.items;
  const featured = useMemo(() => items?.find((e) => e.featured) || items?.[0] || null, [items]);
  const detail = useExpoDetail(featured?._id);
  const others = (items || []).filter((e) => e._id !== featured?._id).slice(0, 3);
  const registeredIds = new Set((registrations.data || []).map((e) => e._id));
  const othersRef = useReveal('[data-item]', [idsKey(others)]);

  if (expos.isError) return <ErrorState error={expos.error} onRetry={expos.refetch} />;

  return (
    <>
      {expos.isLoading ? <Skeleton className="h-96 mb-8 rounded-3xl" /> : <Hero expo={featured} detail={detail.data} />}
      <QuickLinks expoId={featured?._id} />

      {featured && (
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] mb-10">
          <UpcomingSessions expoId={featured._id} />
          <FeaturedExhibitors expoId={featured._id} />
        </div>
      )}

      {others.length > 0 && (
        <section ref={othersRef} aria-labelledby="home-expos" className="space-y-4">
          <SectionHead id="home-expos" title="More upcoming expos" to="/attendee/expos" cta="Browse all expos" />
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{others.map((e) => <ExpoCard key={e._id} expo={e} registered={registeredIds.has(e._id)} />)}</div>
        </section>
      )}
    </>
  );
}
