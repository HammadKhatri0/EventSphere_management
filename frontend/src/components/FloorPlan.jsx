import { useMemo, useRef, useState } from 'react';
import { Minus, Plus, Maximize2 } from 'lucide-react';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/motion.js';
import { cn, fmtMoney } from '../lib/utils.js';
import { assetUrl } from '../lib/api.js';

const U = 40; // viewBox units per grid cell

const STATUS_STYLE = {
  available: { fill: 'color-mix(in srgb, var(--c-success) 20%, var(--c-surface))', stroke: 'var(--c-success)', label: 'Open' },
  reserved: { fill: 'url(#fp-stripes)', stroke: 'var(--c-warning)', label: 'Pending' },
  booked: { fill: 'color-mix(in srgb, var(--c-danger) 22%, var(--c-surface))', stroke: 'var(--c-danger)', label: 'Taken' },
  blocked: { fill: 'url(#fp-hatch)', stroke: 'var(--c-muted)', label: 'Blocked' },
};
const SELECTED = { fill: 'color-mix(in srgb, var(--c-info) 38%, var(--c-surface))', stroke: 'var(--c-info)' };

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clip = (s = '', n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Interactive SVG floor plan shared by organizers, exhibitors and attendees.
 *
 * mode:
 *  - "view"    anyone; booths with details are clickable (onSelect)
 *  - "select"  exhibitor picking a booth: only available booths can be chosen
 *  - "admin"   organizer: every booth clickable, drag (or arrow keys) to move
 *  - "heatmap" colours booths by visit count (`heat`: { [boothId]: visits })
 */
export default function FloorPlan({
  floorPlan = { cols: 24, rows: 14 }, booths = [], mode = 'view', selectedId, highlightId, onSelect, onMove,
  heat, maxHeat = 1, className, label = 'Expo floor plan', showPrice = false,
}) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null);
  const animated = useRef(false);
  const W = floorPlan.cols * U;
  const H = floorPlan.rows * U;

  // entrance animation (once, when booths first arrive)
  useGSAP(() => {
    if (animated.current || !booths.length || prefersReducedMotion()) { if (booths.length) animated.current = true; return; }
    animated.current = true;
    gsap.fromTo('.fp-booth', { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.6)', stagger: { amount: 0.6, from: 'start' }, transformOrigin: '50% 50%' });
  }, { scope: wrapRef, dependencies: [booths.length > 0] });

  // gentle pulse on the selected booth
  useGSAP(() => {
    if (!selectedId || prefersReducedMotion()) return;
    gsap.fromTo(`[data-booth-id="${selectedId}"] rect.fp-shape`, { scale: 1 }, { scale: 1.07, duration: 0.18, yoyo: true, repeat: 1, transformOrigin: '50% 50%' });
  }, { scope: wrapRef, dependencies: [selectedId] });

  const isInteractive = (b) => {
    if (mode === 'select') return b.status === 'available' || b._id === selectedId || b.mine;
    return mode === 'admin' || !!onSelect;
  };

  const toUnits = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x / U, y: p.y / U };
  };

  const onPointerDown = (e, b) => {
    if (mode !== 'admin' || !onMove || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id: b._id, start: toUnits(e), x: b.x, y: b.y, moved: false });
  };
  const onPointerMove = (e, b) => {
    if (!drag || drag.id !== b._id) return;
    const p = toUnits(e);
    const dx = Math.round(p.x - drag.start.x); const dy = Math.round(p.y - drag.start.y);
    const x = Math.min(Math.max(0, b.x + dx), floorPlan.cols - b.w);
    const y = Math.min(Math.max(0, b.y + dy), floorPlan.rows - b.h);
    setDrag((d) => ({ ...d, x, y, moved: d.moved || x !== b.x || y !== b.y }));
  };
  const onPointerUp = (e, b) => {
    if (!drag || drag.id !== b._id) return;
    const d = drag; setDrag(null);
    if (!d.moved) return onSelect?.(b);
    const cand = { ...b, x: d.x, y: d.y };
    const clash = booths.some((o) => o._id !== b._id && overlaps(cand, o));
    if (!clash) onMove(b, { x: d.x, y: d.y });
  };

  const onKeyDown = (e, b) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (isInteractive(b)) onSelect?.(b); return; }
    if (mode === 'admin' && onMove && e.key.startsWith('Arrow') && e.shiftKey) {
      e.preventDefault();
      const dx = { ArrowLeft: -1, ArrowRight: 1 }[e.key] || 0; const dy = { ArrowUp: -1, ArrowDown: 1 }[e.key] || 0;
      const x = b.x + dx; const y = b.y + dy;
      if (x < 0 || y < 0 || x + b.w > floorPlan.cols || y + b.h > floorPlan.rows) return;
      if (!booths.some((o) => o._id !== b._id && overlaps({ ...b, x, y }, o))) onMove(b, { x, y });
    }
  };

  const showTip = (e, b) => {
    const wrap = wrapRef.current.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    setHover({ b, left: r.left - wrap.left + r.width / 2, top: r.top - wrap.top });
  };

  const sorted = useMemo(() => [...booths].sort((a, b) => (a.y - b.y) || (a.x - b.x)), [booths]);

  const heatFill = (v) => `color-mix(in srgb, var(--c-danger) ${Math.round(12 + 70 * Math.min(1, v / Math.max(1, maxHeat)))}%, var(--c-surface))`;

  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center justify-end gap-1 mb-2" role="group" aria-label="Zoom controls">
        <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} className="size-8 grid place-items-center rounded-lg border border-line bg-surface hover:bg-surface-2"><Minus className="size-4" /></button>
        <span className="text-xs w-12 text-center tabular-nums text-muted" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(1)))} className="size-8 grid place-items-center rounded-lg border border-line bg-surface hover:bg-surface-2"><Plus className="size-4" /></button>
        <button type="button" aria-label="Reset zoom" onClick={() => setZoom(1)} className="size-8 grid place-items-center rounded-lg border border-line bg-surface hover:bg-surface-2"><Maximize2 className="size-4" /></button>
      </div>

      <div ref={wrapRef} className="relative rounded-2xl border border-line bg-surface-2/50 overflow-auto max-h-[70vh]" onMouseLeave={() => setHover(null)}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={label} style={{ width: `${zoom * 100}%`, minWidth: 560, display: 'block', touchAction: mode === 'admin' ? 'none' : 'auto' }}>
          <defs>
            <pattern id="fp-grid" width={U} height={U} patternUnits="userSpaceOnUse"><path d={`M ${U} 0 L 0 0 0 ${U}`} fill="none" stroke="var(--c-line)" strokeWidth="1" /></pattern>
            <pattern id="fp-stripes" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="color-mix(in srgb, var(--c-warning) 14%, var(--c-surface))" /><rect width="5" height="10" fill="color-mix(in srgb, var(--c-warning) 38%, var(--c-surface))" /></pattern>
            <pattern id="fp-hatch" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="var(--c-surface-2)" /><path d="M0 0L8 8M8 0L0 8" stroke="var(--c-muted)" strokeWidth="0.8" opacity="0.5" /></pattern>
          </defs>
          <rect x="0" y="0" width={W} height={H} fill="var(--c-surface)" />
          <rect x="0" y="0" width={W} height={H} fill="url(#fp-grid)" opacity="0.7" />
          <rect x="1" y="1" width={W - 2} height={H - 2} fill="none" stroke="var(--c-line)" strokeWidth="2" rx="10" />
          <g aria-hidden="true">
            <rect x={W / 2 - 60} y={H - 22} width="120" height="22" rx="6" fill="var(--c-primary)" opacity="0.92" />
            <text x={W / 2} y={H - 7} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" letterSpacing="2">ENTRANCE</text>
          </g>

          {sorted.map((b) => {
            const live = drag?.id === b._id ? { ...b, x: drag.x, y: drag.y } : b;
            const st = STATUS_STYLE[b.status] || STATUS_STYLE.available;
            const selected = b._id === selectedId;
            const heated = mode === 'heatmap' && heat;
            const visits = heated ? heat[b._id] || 0 : 0;
            const clash = drag?.id === b._id && booths.some((o) => o._id !== b._id && overlaps(live, o));
            const x = live.x * U; const y = live.y * U; const w = b.w * U; const h = b.h * U;
            const company = b.exhibitor?.companyName;
            const fill = selected ? SELECTED.fill : heated ? heatFill(visits) : st.fill;
            const stroke = clash ? 'var(--c-danger)' : selected ? SELECTED.stroke : b.mine ? 'var(--c-primary)' : st.stroke;
            const interactive = isInteractive(b);
            const stateText = selected ? 'selected' : b.status;
            return (
              <g key={b._id} data-booth-id={b._id} className="fp-booth"
                role="button" tabIndex={interactive ? 0 : -1} aria-disabled={!interactive} aria-pressed={selected}
                aria-label={`Booth ${b.code}, ${stateText}${company ? `, ${company}` : ''}${b.zone ? `, ${b.zone}` : ''}${b.price && showPrice ? `, ${fmtMoney(b.price)}` : ''}${heated ? `, ${visits} visits` : ''}`}
                style={{ cursor: !interactive ? 'not-allowed' : mode === 'admin' ? (drag ? 'grabbing' : 'grab') : 'pointer', opacity: !interactive && mode === 'select' ? 0.75 : 1 }}
                onClick={() => { if (mode !== 'admin' && interactive) onSelect?.(b); }}
                onKeyDown={(e) => onKeyDown(e, b)}
                onPointerDown={(e) => onPointerDown(e, b)} onPointerMove={(e) => onPointerMove(e, b)} onPointerUp={(e) => onPointerUp(e, b)}
                onMouseEnter={(e) => showTip(e, b)} onFocus={(e) => showTip(e, b)} onBlur={() => setHover(null)}>
                <rect className={cn('fp-shape', highlightId === b._id && 'booth-pulse')} x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx="8" fill={fill} stroke={stroke} strokeWidth={selected || b.mine || highlightId === b._id ? 3.5 : 2} strokeDasharray={clash ? '5 3' : undefined} />
                {highlightId === b._id && <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx="11" fill="none" stroke="var(--c-info)" strokeWidth="3" className="booth-pulse" />}
                <text x={x + w / 2} y={y + h / 2 - (company || heated || showPrice ? 5 : 0)} textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="800" fill="var(--c-fg)" style={{ pointerEvents: 'none' }}>{b.code}</text>
                <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" dominantBaseline="middle" fontSize="9.5" fontWeight="600" fill="var(--c-muted)" style={{ pointerEvents: 'none' }}>
                  {heated ? `${visits} visits` : company ? clip(company, Math.floor(w / 6.2)) : showPrice && b.status === 'available' ? fmtMoney(b.price) : selected ? 'Selected' : st.label}
                </text>
                {b.mine && <g aria-hidden="true" style={{ pointerEvents: 'none' }}><rect x={x + w - 34} y={y + 5} width="28" height="14" rx="7" fill="var(--c-primary)" /><text x={x + w - 20} y={y + 15} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">YOURS</text></g>}
                {company && b.exhibitor?.logo && w >= 80 && <image href={assetUrl(b.exhibitor.logo)} x={x + 6} y={y + 6} width="18" height="18" style={{ pointerEvents: 'none' }} />}
              </g>
            );
          })}
        </svg>

        {hover && !drag && (
          <div role="tooltip" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full -mt-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl whitespace-nowrap"
            style={{ left: hover.left, top: hover.top }}>
            <p className="font-bold text-sm">Booth {hover.b.code}{hover.b.zone && <span className="font-medium text-muted"> · {hover.b.zone}</span>}</p>
            <p className="text-muted capitalize">{(STATUS_STYLE[hover.b.status] ? { available: 'Available', reserved: 'Pending approval', booked: 'Confirmed', blocked: 'Blocked' }[hover.b.status] : hover.b.status)} · {hover.b.size} ({hover.b.w}×{hover.b.h})</p>
            {hover.b.exhibitor?.companyName && <p className="font-semibold">{hover.b.exhibitor.companyName}</p>}
            {(showPrice || mode !== 'view') && hover.b.status === 'available' && <p className="font-semibold text-success-text">{fmtMoney(hover.b.price)}</p>}
            {mode === 'heatmap' && heat && <p className="font-semibold">{heat[hover.b._id] || 0} visits</p>}
          </div>
        )}
      </div>
      <p className="md:hidden text-xs text-muted mt-2">Swipe sideways to pan the plan, use + / − to zoom.</p>
      <FloorPlanLegend mode={mode} />
      {mode === 'admin' && <p className="text-xs text-muted mt-2">Tip: drag a booth to move it, or focus it and press Shift + arrow keys.</p>}
    </div>
  );
}

export function FloorPlanLegend({ mode = 'view' }) {
  if (mode === 'heatmap') {
    return (
      <div className="flex items-center gap-3 mt-3 text-xs text-muted" aria-label="Heatmap legend">
        <span>Fewer visits</span>
        <span className="h-2.5 w-40 rounded-full" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--c-danger) 12%, var(--c-surface)), var(--c-danger))' }} />
        <span>More visits</span>
      </div>
    );
  }
  const items = [
    ['Available', 'color-mix(in srgb, var(--c-success) 20%, var(--c-surface))', 'var(--c-success)'],
    ['Occupied / confirmed', 'color-mix(in srgb, var(--c-danger) 22%, var(--c-surface))', 'var(--c-danger)'],
    ['Pending approval', 'color-mix(in srgb, var(--c-warning) 32%, var(--c-surface))', 'var(--c-warning)'],
    ['Selected', 'color-mix(in srgb, var(--c-info) 38%, var(--c-surface))', 'var(--c-info)'],
    ['Blocked', 'var(--c-surface-2)', 'var(--c-muted)'],
  ];
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-[13px]" aria-label="Floor plan legend">
      {items.map(([name, fill, stroke]) => (
        <li key={name} className="flex items-center gap-2"><span className="size-4 rounded-md border-2" style={{ background: fill, borderColor: stroke }} />{name}</li>
      ))}
    </ul>
  );
}
