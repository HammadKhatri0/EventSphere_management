import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gsap, useGSAP, prefersReducedMotion, revealIn } from '../lib/motion.js';
import { getSocket, joinExpo } from '../lib/socket.js';
import { get } from '../lib/api.js';

/** Debounce a changing value (search boxes). */
export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/**
 * Animate matching children of a container in (GSAP). Re-runs when `deps` change,
 * e.g. when async data arrives:  const ref = useReveal('[data-reveal]', [data])
 */
export function useReveal(selector = '[data-reveal]', deps = [], opts) {
  const ref = useRef(null);
  useGSAP(() => {
    if (!ref.current) return;
    const els = ref.current.querySelectorAll(selector);
    if (els.length) revealIn(els, opts);
  }, { scope: ref, dependencies: deps });
  return ref;
}

/** Count a number up from 0 (GSAP). Returns a ref to attach to the element showing the number. */
export function useCountUp(value, { format = (n) => Math.round(n).toLocaleString(), duration = 1.1 } = {}) {
  const ref = useRef(null);
  const last = useRef(0);
  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    const target = Number(value) || 0;
    if (prefersReducedMotion()) { el.textContent = format(target); last.current = target; return; }
    const state = { n: last.current };
    gsap.to(state, { n: target, duration, ease: 'power2.out', onUpdate: () => { el.textContent = format(state.n); }, onComplete: () => { last.current = target; } });
  }, { dependencies: [value] });
  return ref;
}

/** Subscribe to a socket event for the lifetime of the component. */
export function useSocketEvent(event, handler) {
  const saved = useRef(handler);
  saved.current = handler;
  useEffect(() => {
    const s = getSocket();
    const fn = (...args) => saved.current(...args);
    s.on(event, fn);
    return () => s.off(event, fn);
  }, [event]);
}

/** Keeps the component subscribed to a public expo room (live booth / schedule updates). */
export function useExpoRoom(expoId) {
  useEffect(() => joinExpo(expoId), [expoId]);
}

/** Tiny form-state helper with server-side field errors. */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);
  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    error: errors[name],
    onChange: (e) => set(name, e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e),
  });
  return { values, setValues, errors, setErrors, set, bind, reset: () => { setValues(initial); setErrors({}); } };
}

// ---------- Shared data hooks ----------
/** Expo list (organizer: own expos incl. drafts; others: public). */
export function useExpos({ mine = false, upcoming = false, limit = 50 } = {}) {
  return useQuery({
    queryKey: ['expos', { mine, upcoming, limit }],
    queryFn: () => get('/expos', { mine: mine || undefined, upcoming: upcoming || undefined, limit }),
    staleTime: 30_000,
  });
}

/**
 * Floor plan with live updates: initial load over REST, then individual booth patches over the socket.
 */
export function useLiveBooths(expoId) {
  const qc = useQueryClient();
  const key = ['booths', expoId];
  const query = useQuery({ queryKey: key, queryFn: () => get(`/expos/${expoId}/booths`), enabled: !!expoId, staleTime: 15_000 });
  useExpoRoom(expoId);

  useSocketEvent('booth:updated', (b) => {
    if (b.expo !== expoId) return;
    qc.setQueryData(key, (old) => {
      if (!old) return old;
      const exists = old.booths.some((x) => x._id === b._id);
      // keep the viewer-specific `mine` flag, which broadcast payloads cannot carry
      const booths = exists ? old.booths.map((x) => (x._id === b._id ? { ...b, mine: x.mine && b.status !== 'available' ? x.mine : undefined } : x)) : [...old.booths, b];
      return { ...old, booths };
    });
  });
  useSocketEvent('booth:deleted', (b) => qc.setQueryData(key, (old) => old && { ...old, booths: old.booths.filter((x) => x._id !== b._id) }));
  useSocketEvent('booths:reload', (p) => { if (p.expoId === expoId) qc.invalidateQueries({ queryKey: key }); });
  useSocketEvent('expo:updated', (p) => { if (p.expoId === expoId) qc.invalidateQueries({ queryKey: ['expo', expoId] }); });
  return query;
}
