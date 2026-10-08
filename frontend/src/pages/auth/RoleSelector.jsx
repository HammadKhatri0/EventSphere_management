import { useLayoutEffect, useRef } from 'react';
import { Building2, ShieldCheck, Ticket } from 'lucide-react';
import { gsap, prefersReducedMotion } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Organizer', icon: ShieldCheck, hint: 'Manage expos' },
  { value: 'exhibitor', label: 'Exhibitor', icon: Building2, hint: 'Showcase & sell' },
  { value: 'attendee', label: 'Attendee', icon: Ticket, hint: 'Explore & connect' },
];

/** Accessible radio-group with a sliding GSAP highlight. */
export default function RoleSelector({ value, onChange, legend = 'I am signing in as' }) {
  const wrap = useRef(null);
  const pill = useRef(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const active = wrap.current?.querySelector('[aria-checked="true"]');
    if (!active || !pill.current) return;
    const props = { x: active.offsetLeft, width: active.offsetWidth, height: active.offsetHeight };
    if (prefersReducedMotion() || !placed.current) gsap.set(pill.current, props);
    else gsap.to(pill.current, { ...props, duration: 0.35, ease: 'power3.out' });
    placed.current = true;
  }, [value]);

  const onKey = (e) => {
    const i = ROLE_OPTIONS.findIndex((r) => r.value === value);
    const next = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (next) { e.preventDefault(); onChange(ROLE_OPTIONS[(i + next + ROLE_OPTIONS.length) % ROLE_OPTIONS.length].value); }
  };

  return (
    <div>
      <p id="role-legend" className="text-sm font-semibold mb-2">{legend}</p>
      <div ref={wrap} role="radiogroup" aria-labelledby="role-legend" onKeyDown={onKey} className="relative grid grid-cols-3 gap-1 p-1 rounded-2xl bg-surface-2 border border-line">
        <span ref={pill} aria-hidden className="absolute top-1 left-0 rounded-xl bg-surface shadow-card border border-line" style={{ width: 0 }} />
        {ROLE_OPTIONS.map((r) => (
          <button key={r.value} type="button" role="radio" aria-checked={value === r.value} tabIndex={value === r.value ? 0 : -1} onClick={() => onChange(r.value)}
            className={cn('relative z-10 flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-sm font-semibold transition-colors', value === r.value ? 'text-primary-text' : 'text-muted hover:text-fg')}>
            <r.icon className="size-5" aria-hidden />{r.label}
            <span className="hidden sm:block text-[11px] font-medium opacity-80">{r.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
