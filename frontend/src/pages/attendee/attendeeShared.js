import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { del, errorMessage, get, post } from '../../lib/api.js';
import { useExpoRoom, useExpos, useSocketEvent } from '../../hooks/index.js';

/* ------------------------------------------------------------------ URL state */
/** Read/patch the query string. Empty values remove the key; edits replace history entries. */
export function useUrlParams() {
  const [params, setSearchParams] = useSearchParams();
  const setParams = useCallback((patch) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    Object.entries(patch).forEach(([k, v]) => (v === undefined || v === null || v === '' ? next.delete(k) : next.set(k, String(v))));
    return next;
  }, { replace: true }), [setSearchParams]);
  return [params, setParams];
}

/** Cheap change key for list data, used as GSAP reveal dependency. */
export const idsKey = (items) => (items || []).map((i) => i._id).join(',');

/* ------------------------------------------------------------------ Expos */
export const expoPhase = (expo, now = Date.now()) => {
  if (expo.status === 'cancelled') return 'cancelled';
  if (expo.status === 'completed' || new Date(expo.endDate).getTime() < now) return 'ended';
  if (new Date(expo.startDate).getTime() <= now) return 'live';
  return 'upcoming';
};

const PHASE_BADGE = {
  live: { status: 'ongoing' },
  upcoming: { status: 'published', label: 'Upcoming' },
  ended: { status: 'completed', label: 'Ended' },
  cancelled: { status: 'cancelled' },
};
export const expoBadgeProps = (expo) => PHASE_BADGE[expoPhase(expo)];

/** Live and upcoming expos first (soonest first), then past ones (most recent first). */
const sortExpos = (items) => {
  const now = Date.now();
  const open = items.filter((e) => new Date(e.endDate).getTime() >= now).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const past = items.filter((e) => new Date(e.endDate).getTime() < now).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  return [...open, ...past];
};

/** Expo picker state persisted as `?expo=`; defaults to the live / next upcoming expo. */
export function useExpoChoice() {
  const [params, setParams] = useUrlParams();
  const query = useExpos({ limit: 50 });
  const expos = useMemo(() => sortExpos(query.data?.items || []), [query.data]);
  const requested = params.get('expo');
  const expo = expos.find((e) => e._id === requested) || expos[0] || null;
  const setExpoId = useCallback((id) => setParams({ expo: id, booth: '', day: '', page: '' }), [setParams]);
  return { expos, expo, expoId: expo?._id, setExpoId, params, setParams, query };
}

export const useExpoDetail = (id) => useQuery({
  queryKey: ['expo', id],
  queryFn: () => get(`/expos/${id}`).then((d) => d.expo),
  enabled: !!id,
});

export function useMyRegistrations() {
  return useQuery({ queryKey: ['registrations'], queryFn: () => get('/expos/registrations/mine').then((d) => d.items) });
}

export function useExpoRegistration(expoId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (register) => (register ? post : del)(`/expos/${expoId}/register`),
    onSuccess: (_res, register) => {
      toast.success(register ? 'You are registered. See you there!' : 'Registration cancelled');
      ['expo', 'registrations', 'sessions', 'agenda'].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => get('/meta'), staleTime: Infinity });

/* ------------------------------------------------------------------ Sessions */
/** All sessions of an expo (with the viewer's `my` state). Refreshes live on `schedule:updated`. */
export function useExpoSessions(expoId) {
  const qc = useQueryClient();
  useExpoRoom(expoId);
  useSocketEvent('schedule:updated', (p) => {
    if (String(p?.expoId) !== String(expoId)) return;
    qc.invalidateQueries({ queryKey: ['sessions', expoId] });
    qc.invalidateQueries({ queryKey: ['agenda'] });
  });
  return useQuery({ queryKey: ['sessions', expoId], queryFn: () => get(`/expos/${expoId}/sessions`), enabled: !!expoId });
}

export const reminderLabel = (min) => {
  if (min < 60) return `${min} min before`;
  if (min < 1440) return `${min / 60} ${min === 60 ? 'hour' : 'hours'} before`;
  return `${min / 1440} ${min === 1440 ? 'day' : 'days'} before`;
};
export const DEFAULT_REMINDER = 15;

/* ------------------------------------------------------------------ Booths */
export const recordBoothVisit = (expoId, boothId) => post(`/expos/${expoId}/booths/${boothId}/visit`).catch(() => {});

/** Records a visit once per booth per mount, whenever a booth becomes selected. */
export function useBoothVisit(expoId, boothId) {
  const seen = useRef(new Set());
  useEffect(() => {
    if (!expoId || !boothId || seen.current.has(boothId)) return;
    seen.current.add(boothId);
    recordBoothVisit(expoId, boothId);
  }, [expoId, boothId]);
}
