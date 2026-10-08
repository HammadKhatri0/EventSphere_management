export const cn = (...parts) => parts.flat().filter(Boolean).join(' ');

const DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const DATE_SHORT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const DATETIME = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const NUMBER = new Intl.NumberFormat();
const CURRENCY = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const fmtDate = (d) => (d ? DATE.format(new Date(d)) : '—');
export const fmtDateShort = (d) => (d ? DATE_SHORT.format(new Date(d)) : '—');
export const fmtTime = (d) => (d ? TIME.format(new Date(d)) : '—');
export const fmtDay = (d) => (d ? WEEKDAY.format(new Date(d)) : '—');
export const fmtDateTime = (d) => (d ? DATETIME.format(new Date(d)) : '—');
export const fmtNumber = (n) => NUMBER.format(n ?? 0);
export const fmtMoney = (n) => CURRENCY.format(n ?? 0);
export const fmtRange = (a, b) => {
  const s = new Date(a); const e = new Date(b);
  return s.toDateString() === e.toDateString() ? fmtDate(s) : `${fmtDateShort(s)} – ${fmtDate(e)}`;
};
export const timeAgo = (d) => {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return fmtDateShort(d);
};
export const daysUntil = (d) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);

/** yyyy-mm-dd in the user's local timezone (for grouping & <input type="date">). */
export const localDay = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
/** value for <input type="datetime-local"> from an ISO date */
export const toLocalInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return `${localDay(x)}T${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
};

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export const ROLE_HOME = { admin: '/admin', exhibitor: '/exhibitor', attendee: '/attendee' };
export const ROLE_LABEL = { admin: 'Organizer', exhibitor: 'Exhibitor', attendee: 'Attendee' };

export const debounce = (fn, ms = 300) => {
  let t;
  const wrapped = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
};

export const groupBy = (items, keyFn) => items.reduce((m, i) => { const k = keyFn(i); (m[k] ||= []).push(i); return m; }, {});
