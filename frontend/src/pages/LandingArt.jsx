/* Decorative illustrations for the landing page (pure SVG, theme/palette aware, hidden from screen readers). */

const mix = (c, pct, other) => `color-mix(in srgb, ${c} ${pct}%, ${other})`;

/** One isometric cube. (x, y) is the top vertex, s the edge length. */
function Cube({ x, y, s, color }) {
  const top = mix(color, 78, 'white');
  const left = color;
  const right = mix(color, 72, 'black');
  const pts = (arr) => arr.map((p) => p.join(',')).join(' ');
  return (
    <g>
      <polygon points={pts([[x, y], [x + s, y + s / 2], [x, y + s], [x - s, y + s / 2]])} style={{ fill: top }} />
      <polygon points={pts([[x - s, y + s / 2], [x, y + s], [x, y + 2 * s], [x - s, y + s * 1.5]])} style={{ fill: left }} />
      <polygon points={pts([[x, y + s], [x + s, y + s / 2], [x + s, y + s * 1.5], [x, y + 2 * s]])} style={{ fill: right }} />
    </g>
  );
}

/** Flat isometric slab (platform). */
function Slab({ cx, y, w, h, t, color }) {
  const pts = (arr) => arr.map((p) => p.join(',')).join(' ');
  return (
    <g>
      <polygon points={pts([[cx, y], [cx + w, y + h], [cx, y + 2 * h], [cx - w, y + h]])} style={{ fill: mix(color, 22, 'var(--c-surface-2)'), stroke: mix(color, 60, 'transparent'), strokeWidth: 1 }} />
      <polygon points={pts([[cx - w, y + h], [cx, y + 2 * h], [cx, y + 2 * h + t], [cx - w, y + h + t]])} style={{ fill: mix(color, 38, 'var(--c-surface)') }} />
      <polygon points={pts([[cx, y + 2 * h], [cx + w, y + h], [cx + w, y + h + t], [cx, y + 2 * h + t]])} style={{ fill: mix(color, 28, 'var(--c-surface)') }} />
    </g>
  );
}

export function FloorArt({ className }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true">
      <Slab cx={110} y={52} w={78} h={30} t={7} color="var(--c-primary)" />
      <Slab cx={110} y={60} w={60} h={23} t={5} color="var(--c-info)" />
      <Cube x={84} y={46} s={13} color="var(--c-success)" />
      <Cube x={112} y={34} s={12} color="#ffffff" />
      <Cube x={136} y={18} s={13} color="var(--c-info)" />
      <Cube x={134} y={52} s={12} color="#8b5cf6" />
      <Cube x={108} y={62} s={11} color="var(--c-success)" />
    </svg>
  );
}

export function IdCardArt({ className }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true">
      <g transform="translate(40 14) skewY(-8)">
        <rect x="0" y="12" width="124" height="84" rx="10" style={{ fill: mix('var(--c-primary)', 14, 'var(--c-surface-2)'), stroke: mix('var(--c-primary)', 55, 'transparent') }} strokeWidth="1.5" />
        <circle cx="30" cy="44" r="11" style={{ fill: mix('var(--c-primary)', 55, 'var(--c-surface)') }} />
        <path d="M12 82c2-14 10-20 18-20s16 6 18 20z" style={{ fill: mix('var(--c-primary)', 55, 'var(--c-surface)') }} />
        <rect x="62" y="34" width="46" height="6" rx="3" style={{ fill: mix('var(--c-primary)', 60, 'var(--c-surface)') }} />
        <rect x="62" y="48" width="36" height="5" rx="2.5" style={{ fill: mix('var(--c-primary)', 35, 'var(--c-surface)') }} />
        <rect x="62" y="60" width="42" height="5" rx="2.5" style={{ fill: mix('var(--c-primary)', 35, 'var(--c-surface)') }} />
        <rect x="62" y="72" width="26" height="5" rx="2.5" style={{ fill: mix('var(--c-primary)', 35, 'var(--c-surface)') }} />
        <circle cx="118" cy="92" r="14" style={{ fill: 'var(--c-success)' }} />
        <path d="M111 92l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function ChartArt({ className }) {
  const bars = [30, 46, 38, 62, 52, 76];
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="la-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--c-info)" />
          <stop offset="1" stopColor="var(--c-primary)" />
        </linearGradient>
      </defs>
      <g transform="translate(44 14) skewY(-6)">
        <rect x="0" y="0" width="140" height="96" rx="10" style={{ fill: mix('var(--c-primary)', 12, 'var(--c-surface-2)'), stroke: mix('var(--c-primary)', 50, 'transparent') }} strokeWidth="1.5" />
        <rect x="12" y="10" width="38" height="5" rx="2.5" style={{ fill: mix('var(--c-primary)', 45, 'var(--c-surface)') }} />
        {bars.map((h, i) => <rect key={i} x={14 + i * 20} y={84 - h} width="11" height={h} rx="3" fill="url(#la-bar)" />)}
        <polyline points="14,68 34,60 54,64 74,46 94,52 114,34 128,40" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function StackArt({ className }) {
  const pts = (arr) => arr.map((p) => p.join(',')).join(' ');
  // frosted layer: translucent top with a bright rim, tinted side faces
  const Layer = ({ y, w, h, t, tint }) => (
    <g>
      <polygon points={pts([[110, y + 2 * h + t], [110 - w, y + h + t], [110 - w, y + h], [110, y + 2 * h]])} fill="url(#sa-side-l)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <polygon points={pts([[110, y + 2 * h + t], [110 + w, y + h + t], [110 + w, y + h], [110, y + 2 * h]])} fill="url(#sa-side-r)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <polygon points={pts([[110, y], [110 + w, y + h], [110, y + 2 * h], [110 - w, y + h]])} fill={tint} stroke="rgba(255,255,255,0.75)" strokeWidth="1" />
    </g>
  );
  return (
    <svg viewBox="0 0 220 192" className={className} aria-hidden="true" style={{ filter: 'drop-shadow(0 14px 22px rgba(8, 20, 80, 0.35))' }}>
      <defs>
        <linearGradient id="sa-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity="0.55" /><stop offset="1" stopColor="#7dd3fc" stopOpacity="0.25" /></linearGradient>
        <linearGradient id="sa-side-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bae6fd" stopOpacity="0.45" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0.2" /></linearGradient>
        <linearGradient id="sa-side-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7dd3fc" stopOpacity="0.4" /><stop offset="1" stopColor="#0ea5e9" stopOpacity="0.18" /></linearGradient>
        <linearGradient id="sa-cube-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6d8cff" /><stop offset="1" stopColor="#4f46e5" /></linearGradient>
        <linearGradient id="sa-cube-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4f6bf0" /><stop offset="1" stopColor="#3730a3" /></linearGradient>
      </defs>
      <Layer y={92} w={102} h={40} t={9} tint="url(#sa-top)" />
      <Layer y={72} w={80} h={31} t={8} tint="url(#sa-top)" />
      <Layer y={54} w={58} h={22} t={7} tint="url(#sa-top)" />
      <g style={{ filter: 'drop-shadow(0 0 12px rgba(130, 160, 255, 0.9))' }}>
        <polygon points={pts([[110, 6], [136, 19], [110, 32], [84, 19]])} fill="#a5c4ff" />
        <polygon points={pts([[84, 19], [110, 32], [110, 62], [84, 49]])} fill="url(#sa-cube-l)" />
        <polygon points={pts([[110, 32], [136, 19], [136, 49], [110, 62]])} fill="url(#sa-cube-r)" />
      </g>
    </svg>
  );
}

/** Thin concentric arcs sweeping in from the right edge of the hero (decorative backdrop). */
export function HeroArcs({ className }) {
  const mask = 'linear-gradient(to left, black 25%, transparent 95%)';
  return (
    <svg viewBox="0 0 640 600" className={className} aria-hidden="true" style={{ maskImage: mask, WebkitMaskImage: mask }}>
      <g fill="none" strokeWidth="1.6" style={{ stroke: 'rgb(var(--c-glow-1) / 0.9)' }}>
        <circle cx="660" cy="130" r="250" />
        <circle cx="660" cy="130" r="330" style={{ strokeOpacity: 0.65 }} />
        <circle cx="660" cy="130" r="420" style={{ strokeOpacity: 0.4 }} />
        <circle cx="660" cy="130" r="520" style={{ strokeOpacity: 0.22 }} />
      </g>
    </svg>
  );
}
