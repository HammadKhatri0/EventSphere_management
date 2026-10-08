import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Ticket } from 'lucide-react';
import { get } from '../../lib/api.js';
import { useExpos } from '../../hooks/index.js';
import { Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, Select } from '../../components/ui/index.jsx';

/** Server enums (categories, session types, …). Static, so cached for the whole session. */
export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => get('/meta'), staleTime: Infinity });
}

/** A single string kept in the URL search params (`?name=value`). The fallback is omitted from the URL. */
export function useUrlState(name, fallback = '') {
  const [params, setParams] = useSearchParams();
  const value = params.get(name) ?? fallback;
  const set = useCallback((next) => {
    setParams((prev) => {
      const out = new URLSearchParams(prev);
      if (next === undefined || next === '' || next === fallback) out.delete(name); else out.set(name, next);
      return out;
    }, { replace: true });
  }, [name, fallback, setParams]);
  return [value, set];
}

/** The organizer's expos plus the one currently selected via `?expo=<id>`. */
export function useSelectedExpo() {
  const [params, setParams] = useSearchParams();
  const query = useExpos({ mine: true, limit: 100 });
  const expos = query.data?.items || [];
  const wanted = params.get('expo');
  // default to the soonest expo that is open to the public, otherwise the newest one
  const expo = expos.find((e) => e._id === wanted) || expos.filter((e) => ['published', 'ongoing'].includes(e.status)).at(-1) || expos[0];
  const setExpoId = useCallback((id) => {
    setParams((prev) => { const out = new URLSearchParams(prev); out.set('expo', id); return out; }, { replace: true });
  }, [setParams]);
  return { ...query, expos, expo, expoId: expo?._id, setExpoId };
}

export function ExpoSelect({ expos, value, onChange, label = 'Expo', className }) {
  return (
    <Select label={label} value={value || ''} onChange={(e) => onChange(e.target.value)} wrapperClassName={className}
      options={expos.map((e) => ({ value: e._id, label: e.title }))} />
  );
}

export function NoExposState() {
  return (
    <Card data-reveal>
      <EmptyState icon={Ticket} title="Create your first expo" text="Floor plans, schedules and analytics are managed per expo. Start by creating one."
        action={<Button to="/admin/expos/new" icon={Plus}>New expo</Button>} />
    </Card>
  );
}

/**
 * Page chrome for per-expo screens: header, expo picker (persisted in `?expo=`) and the
 * loading / error / no-expo states. `children(expo)` renders once an expo is selected.
 */
export function ExpoScope({ title, subtitle, actions, children }) {
  const sel = useSelectedExpo();
  if (sel.isLoading) return <><PageHeader title={title} subtitle={subtitle} /><PageLoader /></>;
  if (sel.isError) return <><PageHeader title={title} subtitle={subtitle} /><ErrorState error={sel.error} onRetry={sel.refetch} /></>;
  if (!sel.expos.length) return <><PageHeader title={title} subtitle={subtitle} /><NoExposState /></>;
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      <ExpoSelect expos={sel.expos} value={sel.expoId} onChange={sel.setExpoId} className="mb-5 max-w-sm" />
      {children(sel.expo)}
    </>
  );
}

/** Trailing-edge throttle for socket-driven refetches. */
export function useThrottledCallback(fn, ms = 3000) {
  const saved = useRef(fn);
  saved.current = fn;
  const state = useRef({ last: 0, timer: null });
  useEffect(() => () => clearTimeout(state.current.timer), []);
  return useCallback((...args) => {
    const s = state.current;
    const wait = ms - (Date.now() - s.last);
    if (wait <= 0) { s.last = Date.now(); saved.current(...args); return; }
    if (!s.timer) s.timer = setTimeout(() => { s.timer = null; s.last = Date.now(); saved.current(...args); }, wait);
  }, [ms]);
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Maps API field paths (`location.venue`) onto flat form field names. */
export const mapErrors = (errors, aliases) => {
  const out = { ...errors };
  Object.entries(aliases).forEach(([flat, path]) => { if (errors[path]) out[flat] = errors[path]; });
  return out;
};
