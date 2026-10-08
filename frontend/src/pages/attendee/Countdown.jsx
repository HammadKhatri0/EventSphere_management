import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils.js';

const parts = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [['Days', Math.floor(s / 86400)], ['Hours', Math.floor((s % 86400) / 3600)], ['Minutes', Math.floor((s % 3600) / 60)], ['Seconds', s % 60]];
};

/** Ticking countdown. The visual boxes are hidden from assistive tech; a text summary updates once a minute. */
export default function Countdown({ target, className }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = new Date(target).getTime() - now;
  if (remaining <= 0) return null;
  const [days, hours, minutes] = parts(remaining).map(([, v]) => v);
  const summary = `Starts in ${days} days, ${hours} hours and ${minutes} minutes`;
  return (
    <div role="timer" aria-label={summary} className={cn('flex gap-2 sm:gap-3', className)}>
      {parts(remaining).map(([label, value]) => (
        <div key={label} aria-hidden className="hero-fade min-w-16 sm:min-w-20 rounded-2xl border border-line bg-surface/80 backdrop-blur px-3 py-2.5 text-center shadow-card">
          <div className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-none">{String(value).padStart(2, '0')}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-muted font-semibold">{label}</div>
        </div>
      ))}
    </div>
  );
}
