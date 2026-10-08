import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../lib/api.js';
import { getSocket } from '../../lib/socket.js';
import { useReveal } from '../../hooks/index.js';

/** Query keys shared across the exhibitor pages, so mutations can invalidate precisely. */
export const KEYS = {
  profile: ['exhibitor-profile'],
  applications: ['applications', 'mine'],
  myBooths: ['my-booths'],
  dashboard: ['exhibitor-dashboard'],
  inquiries: ['inquiries'],
  conversations: ['conversations'],
  tickets: ['tickets'],
};

/** The exhibitor's company profile, or `null` when none has been created yet. */
export const useMyProfile = () =>
  useQuery({ queryKey: KEYS.profile, queryFn: () => get('/exhibitors/profile/me').then((d) => d.profile) });

export const useMyApplications = () =>
  useQuery({ queryKey: KEYS.applications, queryFn: () => get('/applications/mine').then((d) => d.items) });

export const useMyBooths = () =>
  useQuery({ queryKey: KEYS.myBooths, queryFn: () => get('/booths/mine').then((d) => d.items) });

/** Static platform metadata: categories, booth limits. */
export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => get('/meta'), staleTime: Infinity });

/** Staggers `[data-reveal]` elements in once the page's data has arrived. */
export const usePageReveal = (ready) => useReveal('[data-reveal]', [!!ready]);

/** Runs `handler` whenever any of the socket `events` fires. */
export function useSocketEvents(events, handler) {
  const saved = useRef(handler);
  saved.current = handler;
  const names = events.join(',');
  useEffect(() => {
    const socket = getSocket();
    const list = names.split(',');
    const run = () => saved.current();
    list.forEach((e) => socket.on(e, run));
    return () => list.forEach((e) => socket.off(e, run));
  }, [names]);
}

const filled = (v) => v !== undefined && v !== null && v !== '';
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => filled(v)));

/**
 * Maps a loaded (or edited) profile to the body `PUT /exhibitors/profile/me` accepts:
 * server-managed fields (_id, timestamps, uploadedAt, user) are dropped, and values that
 * would fail URL / email validation when empty are omitted instead of sent as ''.
 */
export function toProfilePayload(p) {
  const contact = p.contact || {};
  return {
    companyName: (p.companyName || '').trim(),
    tagline: p.tagline || '',
    description: p.description || '',
    logo: p.logo || '',
    website: p.website?.trim() || '',
    categories: p.categories || [],
    contact: { email: contact.email?.trim() || '', phone: contact.phone || '', address: contact.address || '' },
    products: (p.products || []).map((x) => ({ name: x.name, description: x.description || '', image: x.image || '' })),
    documents: (p.documents || []).map((d) => ({ name: d.name || '', url: d.url })),
    staff: (p.staff || []).map((s) => ({ name: s.name, role: s.role || '', phone: s.phone || '', ...compact({ email: s.email?.trim() }) })),
  };
}

/** Strips a `staff.3.` style prefix so server field errors map onto a modal form's field names. */
export const stripFieldPrefix = (errors, prefix) =>
  Object.fromEntries(Object.entries(errors).map(([k, v]) => [k.replace(new RegExp(`^${prefix}\\.\\d+\\.`), ''), v]));
