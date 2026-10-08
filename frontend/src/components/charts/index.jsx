import { useMemo, useRef } from 'react';
import { gsap, useGSAP, prefersReducedMotion } from '../../lib/motion.js';
import { fmtNumber } from '../../lib/utils.js';

/** Horizontal bar list: accessible (real text), animates widths with GSAP. */
export function BarList({ data, color = 'var(--c-primary)', valueFormat = fmtNumber, empty = 'No data yet', max }) {
  const ref = useRef(null);
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from('.bar-fill', { scaleX: 0, transformOrigin: 'left center', duration: 0.8, stagger: 0.06, ease: 'power3.out' });
  }, { scope: ref, dependencies: [data.length, top] });
  if (!data.length) return <p className="text-sm text-muted py-6 text-center">{empty}</p>;
  return (
    <ul ref={ref} className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium truncate">{d.label}</span>
            <span className="tabular-nums text-muted shrink-0">{d.display ?? valueFormat(d.value)}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-surface-2 overflow-hidden" aria-hidden>
            <div className="bar-fill h-full rounded-full" style={{ width: `${(d.value / top) * 100}%`, background: d.color || color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Multi-series line/area chart. series: [{ name, color, points: [{ x: 'label', y: number }] }] */
export function LineChart({ series, height = 220, area = true, className }) {
  const ref = useRef(null);
  const W = 640; const P = { t: 14, r: 12, b: 28, l: 34 };
  const labels = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort(), [series]);
  const max = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.y)));
  const niceMax = Math.ceil(max / 4) * 4 || 4;
  const sx = (i) => P.l + (labels.length <= 1 ? (W - P.l - P.r) / 2 : (i / (labels.length - 1)) * (W - P.l - P.r));
  const sy = (v) => P.t + (1 - v / niceMax) * (height - P.t - P.b);

  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from('.lc-line', { strokeDashoffset: 1, duration: 1.1, ease: 'power2.out', stagger: 0.15 });
    gsap.from('.lc-area', { opacity: 0, duration: 0.9, delay: 0.3 });
  }, { scope: ref, dependencies: [JSON.stringify(series)] });

  if (!labels.length) return <p className="text-sm text-muted py-10 text-center">No data yet</p>;
  const tickIdx = labels.length <= 6 ? labels.map((_, i) => i) : [0, Math.floor(labels.length / 3), Math.floor((2 * labels.length) / 3), labels.length - 1];
  return (
    <div ref={ref} className={className}>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full h-auto" role="img" aria-label={`Line chart: ${series.map((s) => s.name).join(', ')}`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const v = (niceMax / 4) * i;
          return <g key={i}><line x1={P.l} x2={W - P.r} y1={sy(v)} y2={sy(v)} stroke="var(--c-line)" strokeDasharray={i ? '3 4' : undefined} /><text x={P.l - 6} y={sy(v) + 4} textAnchor="end" fontSize="10" fill="var(--c-muted)">{Math.round(v)}</text></g>;
        })}
        {tickIdx.map((i) => <text key={i} x={sx(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--c-muted)">{String(labels[i]).slice(5)}</text>)}
        {series.map((s, si) => {
          const map = new Map(s.points.map((p) => [p.x, p.y]));
          const pts = labels.map((l, i) => [sx(i), sy(map.get(l) || 0)]);
          const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
          return (
            <g key={s.name}>
              <defs><linearGradient id={`lc-g-${si}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity="0.28" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient></defs>
              {area && <path className="lc-area" d={`${d} L${pts.at(-1)[0]},${sy(0)} L${pts[0][0]},${sy(0)} Z`} fill={`url(#lc-g-${si})`} />}
              <path className="lc-line" d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength="1" strokeDasharray="1" />
              {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="var(--c-surface)" stroke={s.color} strokeWidth="2"><title>{`${s.name} · ${labels[i]}: ${map.get(labels[i]) || 0}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <ul className="flex gap-4 mt-2 text-xs text-muted">{series.map((s) => <li key={s.name} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.name}</li>)}</ul>
      )}
    </div>
  );
}

/** Donut with centre label and an accessible legend. segments: [{ label, value, color }] */
export function Donut({ segments, centerLabel, centerValue, size = 160 }) {
  const ref = useRef(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 54; const c = 2 * Math.PI * r;
  let offset = 0;
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    gsap.from('.dn-seg', { strokeDasharray: `0 ${c}`, duration: 0.9, stagger: 0.1, ease: 'power2.out' });
  }, { scope: ref, dependencies: [total] });
  return (
    <div ref={ref} className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={`Breakdown: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--c-surface-2)" strokeWidth="16" />
        {total > 0 && segments.map((s) => {
          const len = (s.value / total) * c;
          const el = <circle key={s.label} className="dn-seg" cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />;
          offset += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--c-fg)">{centerValue ?? total}</text>
        <text x="70" y="86" textAnchor="middle" fontSize="9.5" fill="var(--c-muted)">{centerLabel}</text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {segments.map((s) => <li key={s.label} className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ background: s.color }} /><span className="text-muted">{s.label}</span><span className="font-semibold tabular-nums ml-auto pl-4">{s.value}</span></li>)}
      </ul>
    </div>
  );
}

export const CHART_COLORS = { primary: 'var(--c-primary)', success: 'var(--c-success)', warning: 'var(--c-warning)', danger: 'var(--c-danger)', info: 'var(--c-info)', muted: 'var(--c-muted)' };