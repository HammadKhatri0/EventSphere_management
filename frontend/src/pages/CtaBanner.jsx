import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/index.jsx';
import { OrbitArt, StackArt } from './LandingArt.jsx';

/** Vivid call-to-action banner shared by the public marketing pages. */
export default function CtaBanner({ title = 'Ready to host your next expo?', text = 'Bring your community together and create unforgettable expo experiences.' }) {
  return (
    <section className="reveal-section px-5 py-20">
      <div className="reveal-item relative overflow-hidden max-w-6xl mx-auto rounded-[2rem] text-white px-6 py-10 sm:px-14 sm:py-12 text-center ring-1 ring-white/25 shadow-[0_30px_80px_-30px_var(--c-ban-3)]">
        {/* Backdrop at 50% opacity — kept off the root because the scroll-reveal animation owns the root's opacity. */}
        <div className="absolute inset-0 opacity-70 bg-gradient-to-r from-ban-1 via-ban-2 to-ban-3 pointer-events-none" aria-hidden>
          <span className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
          <span className="absolute -left-24 -top-24 size-80 rounded-full bg-white/15 blur-3xl" />
          <span className="absolute -right-10 bottom-0 size-72 rounded-full bg-cyan-300/25 blur-3xl" />
        </div>
        <div className="hidden md:block absolute -left-2 top-1/2 -translate-y-1/2 w-56 lg:w-64 pointer-events-none" aria-hidden><OrbitArt className="cta-art w-full" /></div>
        <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 w-64 lg:w-72 pointer-events-none px-5" aria-hidden><StackArt className="cta-art w-full" /></div>
        <div className="relative max-w-2xl mx-auto md:px-24 lg:px-12 [text-shadow:0_1px_14px_rgb(0_0_0/0.4)]">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">{title}</h2>
          <p className="mt-3 text-white/90 text-base sm:text-lg">{text}</p>
          <div className="mt-7 flex justify-center items-center gap-3 flex-wrap">
            <Button size="lg" to="/register" className="!bg-white !text-slate-900 hover:!bg-slate-50 shadow-lg">Get started for free <ArrowRight className="size-4" aria-hidden /></Button>
            <Button size="lg" variant="ghost" to="/login" className="text-white hover:bg-white/15">Sign in</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
