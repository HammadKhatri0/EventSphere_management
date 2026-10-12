import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Building2, CheckCircle2, ChevronRight, Map, ShieldCheck, Ticket, Users } from 'lucide-react';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/motion.js';
import { PublicFooter, SiteHeader } from '../components/layout/PublicShell.jsx';
import { useScrollReveal } from '../hooks/index.js';
import { Button } from '../components/ui/index.jsx';
import { ChartArt, FloorArt, HeroArcs, IdCardArt } from './LandingArt.jsx';
import CtaBanner from './CtaBanner.jsx';

const FEATURES = [
  { icon: Map, title: 'Smart Floor Plans', text: 'Design and manage your expo floor with real-time booth availability and dynamic layouts.', Art: FloorArt },
  { icon: Users, title: 'Exhibitor Management', text: 'Onboard exhibitors, manage their details, and keep everything organized in one place.', Art: IdCardArt },
  { icon: BarChart3, title: 'Live Operations', text: 'Monitor activity, track attendance, and get real-time insights during your expo.', Art: ChartArt },
];

const ROLES = [
  { role: 'admin', title: 'Organizer', text: 'Plan and run your expo with powerful tools, real-time insights, and full control.', icon: Ticket, card: 'from-primary-soft dark:from-primary/30 border-primary/30 dark:border-primary/55', arc: 'text-primary', chip: 'bg-primary' },
  { role: 'exhibitor', title: 'Exhibitor', text: 'Manage your booth, showcase your products, and connect with attendees.', icon: Building2, card: 'from-info-soft dark:from-info/30 border-info/30 dark:border-info/55', arc: 'text-info', chip: 'bg-info' },
  { role: 'attendee', title: 'Attendee', text: 'Explore exhibitors, attend sessions, and make the most of the expo.', icon: Users, card: 'from-success-soft dark:from-success/25 border-success/30 dark:border-success/55', arc: 'text-success', chip: 'bg-success' },
];

// decorative mini floor plan (6 x 4)
const STATUS = ['ok', 'bad', 'ok', 'wait', 'ok', 'ok', 'bad', 'ok', 'bad', 'ok', 'ok', 'bad', 'wait', 'bad', 'ok', 'ok', 'ok', 'wait', 'ok', 'bad', 'ok', 'ok', 'wait', 'bad'];

function SectionHeading({ label, children, text }) {
  return (
    <div className="max-w-2xl reveal-item">
      <p className="text-xs font-bold text-primary-text uppercase tracking-[0.18em]">{label}</p>
      <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 leading-tight">{children}</h2>
      {text && <p className="text-muted mt-3 text-lg">{text}</p>}
    </div>
  );
}

export default function Landing() {
  const root = useRef(null);

  useGSAP(() => {
    if (prefersReducedMotion()) return undefined;
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.from('.hero-badge', { y: 20, opacity: 0, duration: 0.6 })
      .from('.hero-word', { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.07 }, '<0.1')
      .from('.hero-sub', { y: 20, opacity: 0, duration: 0.7 }, '-=0.5')
      .from('.hero-card', { y: 30, opacity: 0, duration: 0.8 }, '-=0.9')
      .from('.mini-booth', { scale: 0, opacity: 0, duration: 0.45, ease: 'back.out(2)', stagger: { amount: 0.8, grid: [4, 6], from: 'center' } }, '-=0.6')
      .from('.float-card', { y: 16, opacity: 0, duration: 0.6, stagger: 0.15 }, '-=0.3');
    gsap.to('.float-card', { y: -8, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.6, delay: 1.5 });
    gsap.to('.cta-art', { y: -10, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    return undefined;
  }, { scope: root });
  useScrollReveal(root);

  const headline = ['Every', 'expo,', 'perfectly', 'orchestrated.'];

  return (
    <div ref={root} className="landing-page min-h-dvh">
      <a href="#content" className="skip-link">Skip to content</a>

      <SiteHeader overlay />

      <main id="content" tabIndex={-1} className="focus:outline-none">
        {/* ---------------------------------------------------------------- hero */}
        <section className="hero-bg relative pt-32 pb-24 overflow-hidden">
          <HeroArcs className="absolute right-0 top-0 h-[600px] w-[640px] max-w-full pointer-events-none opacity-50 dark:opacity-90" />
          <div className="relative max-w-6xl mx-auto px-5 grid lg:grid-cols-[0.9fr_1.1fr] gap-14 items-center">
            <div>
              <span className="hero-badge inline-flex rounded-full border border-primary/30 bg-primary-soft px-3.5 py-1.5 text-[13px] font-semibold text-primary-text">Event &amp; expo management platform</span>
              <h1 className="mt-6 text-5xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight max-w-md" aria-label="Every expo, perfectly orchestrated.">
                {headline.map((w, i) => (
                  <span key={w} className="inline-block overflow-hidden align-bottom pr-3 pb-1" aria-hidden>
                    <span className={`hero-word inline-block ${i > 1 ? 'gradient-text' : ''}`}>{w}</span>
                  </span>
                ))}
              </h1>
              <p className="hero-sub mt-6 text-lg text-muted max-w-md">EventSphere brings organizers, exhibitors, and attendees together — from booth registration, scheduling, and insightful analytics to a seamless, world-class experience.</p>
            </div>

            <div className="relative lg:pl-6" aria-hidden>
              <div className="hero-card glass-card p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4"><span className="size-2.5 rounded-full bg-success animate-pulse" /><p className="font-bold text-sm">Floor Plan – Live</p></div>
                <div className="grid grid-cols-6 gap-2.5 sm:gap-3">
                  {STATUS.map((s, i) => <div key={i} className={`mini-booth neon neon-${s} aspect-square rounded-xl`} />)}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-muted">
                  <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-success" />Available</span>
                  <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-danger" />Occupied</span>
                  <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-warning" />Pending</span>
                </div>
              </div>
              <div className="float-card card absolute -top-5 right-0 sm:-right-4 px-3.5 py-2.5 flex items-center gap-3">
                <span className="size-9 rounded-lg bg-primary-soft text-primary-text grid place-items-center"><BarChart3 className="size-[18px]" /></span>
                <span><span className="block text-[13px] font-bold">Maya Patel (Exhibitor)</span><span className="text-xs text-muted">Booth B12</span></span>
              </div>
              <div className="float-card card absolute -bottom-9 left-0 sm:-left-4 px-3.5 py-2.5 flex items-center gap-3">
                <span className="size-9 rounded-full bg-success-soft text-success-text grid place-items-center"><CheckCircle2 className="size-5" /></span>
                <span><span className="block text-[13px] font-bold">Booth B12 Confirmed</span><span className="text-xs text-muted">2m ago · Verified</span></span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- platform */}
        <section className="reveal-section border-t border-line/60" aria-labelledby="platform-h"><div className="max-w-6xl mx-auto px-5 py-20">
          <SectionHeading label="Platform" text="Powerful tools and intuitive features to plan, manage, and grow your expo — all in one platform.">
            <span id="platform-h">Everything an expo needs, nothing it <span className="gradient-text">doesn&rsquo;t.</span></span>
          </SectionHeading>
          <ul className="mt-12 grid md:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, text, Art }) => (
              <li key={title} className="reveal-item glass-card relative overflow-hidden p-6 min-h-[17rem] flex flex-col hover:-translate-y-1 transition group">
                <div className="flex items-start justify-between">
                  <span className="size-11 rounded-xl bg-primary-soft text-primary-text grid place-items-center border border-primary/20"><Icon className="size-5" aria-hidden /></span>
                  <Link to="/register" aria-label={`Learn more about ${title}`} className="size-8 rounded-full border border-line grid place-items-center text-muted group-hover:text-fg group-hover:border-primary transition"><ChevronRight className="size-4" aria-hidden /></Link>
                </div>
                <h3 className="mt-5 text-xl font-bold">{title}</h3>
                <p className="text-muted mt-2 max-w-[15rem]">{text}</p>
                <Link to="/register" className="mt-auto pt-5 text-sm font-semibold text-primary-text inline-flex items-center gap-1.5 hover:underline">Learn more <ArrowRight className="size-4 group-hover:translate-x-1 transition" aria-hidden /></Link>
                <Art className="absolute -bottom-3 -right-3 w-48 pointer-events-none" />
              </li>
            ))}
          </ul>
        </div></section>

        {/* -------------------------------------------------------- get started */}
        <section className="reveal-section landing-band py-20" aria-labelledby="roles-h">
          <div className="max-w-6xl mx-auto px-5">
            <SectionHeading label="Get started" text="Whether you’re hosting, exhibiting, or attending, we’ve got you covered.">
              <span id="roles-h">Sign in as who you are — land where you <span className="gradient-text">belong.</span></span>
            </SectionHeading>
            <div className="mt-12 grid md:grid-cols-3 gap-5">
              {ROLES.map(({ role, title, text, icon: Icon, card, arc, chip }) => (
                <div key={role} className={`reveal-item relative overflow-hidden rounded-2xl border bg-gradient-to-br ${card} to-surface p-7 shadow-card hover:-translate-y-1 transition`}>
                  <span aria-hidden className={`pointer-events-none absolute -right-14 -top-14 size-48 rounded-full border border-current opacity-25 ${arc}`} />
                  <span aria-hidden className={`pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border border-current opacity-15 ${arc}`} />
                  <span className={`size-12 rounded-full ${chip} text-white grid place-items-center shadow-md`}><Icon className="size-6" aria-hidden /></span>
                  <h3 className="mt-5 text-xl font-bold">{title}</h3>
                  <p className="text-muted mt-2 min-h-[3.5rem]">{text}</p>
                  <Button to="/login" state={{ role }} size="sm" className="mt-6 !bg-white !text-slate-900 border !border-slate-200 hover:!bg-slate-50 shadow-sm">Continue as {title} <ArrowRight className="size-4" aria-hidden /></Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CtaBanner />
      </main>

      <PublicFooter />
    </div>
  );
}
