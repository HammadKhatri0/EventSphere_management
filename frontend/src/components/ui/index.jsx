import { forwardRef, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Loader2, Search, Upload, X } from 'lucide-react';
import { cn, initials, fmtNumber } from '../../lib/utils.js';
import { assetUrl, errorMessage, uploadFile } from '../../lib/api.js';
import { useCountUp } from '../../hooks/index.js';
import { toast } from 'sonner';
import { useState } from 'react';

export { Modal, ConfirmModal } from './Modal.jsx';

/* ------------------------------------------------------------------ Button */
const BTN = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-2',
  soft: 'bg-primary-soft text-primary-text hover:brightness-95',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-110',
  success: 'bg-success text-white hover:brightness-110',
};
const SIZES = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' };

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading, icon: Icon, as: As, to, className, children, disabled, type = 'button', ...rest }, ref) {
  const cls = cn('inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap transition active:scale-[0.98] disabled:opacity-55 disabled:pointer-events-none select-none', BTN[variant], SIZES[size], className);
  const inner = (<>{loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}{children}</>);
  if (to) return <Link ref={ref} to={to} className={cls} {...rest}>{inner}</Link>;
  const Tag = As || 'button';
  return <Tag ref={ref} type={Tag === 'button' ? type : undefined} disabled={disabled || loading} aria-busy={loading || undefined} className={cls} {...rest}>{inner}</Tag>;
});

export const IconButton = forwardRef(function IconButton({ label, icon: Icon, className, ...rest }, ref) {
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={cn('inline-grid place-items-center size-10 rounded-xl text-muted hover:text-fg hover:bg-surface-2 transition', className)} {...rest}>
      <Icon className="size-5" aria-hidden />
    </button>
  );
});

/* ------------------------------------------------------------------ Form fields */
export function Field({ label, hint, error, required, htmlFor, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label htmlFor={htmlFor} className="block text-sm font-semibold">{label}{required && <span className="text-danger" aria-hidden> *</span>}</label>}
      {children}
      {error ? <p id={`${htmlFor}-err`} role="alert" className="text-[13px] text-danger-text flex items-center gap-1"><AlertTriangle className="size-3.5 shrink-0" aria-hidden />{error}</p>
        : hint ? <p id={`${htmlFor}-hint`} className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

const inputBase = 'w-full rounded-xl border bg-surface px-3.5 text-sm placeholder:text-muted/70 transition focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-60 disabled:bg-surface-2';
const inputState = (error) => (error ? 'border-danger' : 'border-line hover:border-muted/60');

export const Input = forwardRef(function Input({ label, hint, error, required, icon: Icon, className, wrapperClassName, ...rest }, ref) {
  const autoId = useId();
  const id = rest.id || autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={wrapperClassName}>
      <div className="relative">
        {Icon && <Icon className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden />}
        <input ref={ref} id={id} required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={cn(inputBase, inputState(error), 'h-11', Icon && 'pl-10', className)} {...rest} />
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, hint, error, required, rows = 4, className, wrapperClassName, ...rest }, ref) {
  const autoId = useId();
  const id = rest.id || autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={wrapperClassName}>
      <textarea ref={ref} id={id} rows={rows} required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={cn(inputBase, inputState(error), 'py-2.5 resize-y min-h-24', className)} {...rest} />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, hint, error, required, options, placeholder, className, wrapperClassName, children, ...rest }, ref) {
  const autoId = useId();
  const id = rest.id || autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={wrapperClassName}>
      <select ref={ref} id={id} required={required} aria-invalid={!!error} className={cn(inputBase, inputState(error), 'h-11 pr-8 appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat', className)}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options ? options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)) : children}
      </select>
    </Field>
  );
});

export function Checkbox({ label, error, className, ...rest }) {
  const autoId = useId();
  const id = rest.id || autoId;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-start gap-2.5 text-sm cursor-pointer">
        <input id={id} type="checkbox" className="mt-0.5 size-4.5 rounded border-line accent-[var(--c-primary)]" aria-invalid={!!error} {...rest} />
        <span>{label}</span>
      </label>
      {error && <p role="alert" className="text-[13px] text-danger-text mt-1">{error}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50', checked ? 'bg-primary' : 'bg-line')}>
      <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className, ...rest }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className={cn(inputBase, 'h-11 pl-10 border-line')} {...rest} />
    </div>
  );
}

/** Image / document picker that uploads immediately and reports the stored URL. */
export function FileUpload({ label, kind = 'image', value, onChange, onUploaded, accept, hint, className, buttonText }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('File is too large (max 5 MB)');
    setBusy(true);
    try {
      const up = await uploadFile(file, kind);
      onChange?.(up.url, up);
      onUploaded?.(up);
      toast.success('Uploaded');
    } catch (err) { toast.error(errorMessage(err, 'Upload failed')); } finally { setBusy(false); }
  };
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label htmlFor={id} className="block text-sm font-semibold">{label}</label>}
      <div className="flex items-center gap-3">
        {kind === 'image' && value && <img src={assetUrl(value)} alt="" className="size-14 rounded-xl object-cover border border-line" />}
        <Button variant="secondary" size="sm" icon={Upload} loading={busy} onClick={() => ref.current?.click()}>{buttonText || (value ? 'Replace' : 'Upload')}</Button>
        {value && kind === 'image' && <Button variant="ghost" size="sm" onClick={() => onChange?.('')}>Remove</Button>}
        <input ref={ref} id={id} type="file" hidden onChange={pick} accept={accept || (kind === 'image' ? 'image/png,image/jpeg,image/webp,image/gif' : 'application/pdf,image/png,image/jpeg,image/webp')} />
      </div>
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Display */
export const Card = forwardRef(function Card({ className, as: As = 'div', ...rest }, ref) {
  return <As ref={ref} className={cn('card', className)} {...rest} />;
});

export function CardHeader({ title, subtitle, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 p-5 pb-0', className)}>
      <div className="min-w-0"><h2 className="text-base font-bold">{title}</h2>{subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  neutral: 'bg-surface-2 text-muted border-line',
  primary: 'bg-primary-soft text-primary-text border-transparent',
  success: 'bg-success-soft text-success-text border-transparent',
  warning: 'bg-warning-soft text-warning-text border-transparent',
  danger: 'bg-danger-soft text-danger-text border-transparent',
  info: 'bg-info-soft text-info-text border-transparent',
};
export function Badge({ tone = 'neutral', icon: Icon, className, children }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[tone], className)}>{Icon && <Icon className="size-3" aria-hidden />}{children}</span>;
}

const STATUS = {
  // booths
  available: ['success', 'Available'], reserved: ['warning', 'Pending Approval'], booked: ['danger', 'Booth Confirmed'], blocked: ['neutral', 'Blocked'],
  // applications / inquiries
  pending: ['warning', 'Pending Review'], approved: ['success', 'Approved'], rejected: ['danger', 'Rejected'], withdrawn: ['neutral', 'Withdrawn'],
  accepted: ['success', 'Accepted'], declined: ['danger', 'Declined'], completed: ['info', 'Completed'],
  // expos
  draft: ['neutral', 'Draft'], published: ['success', 'Published'], ongoing: ['primary', 'Live now'], cancelled: ['danger', 'Cancelled'],
  // tickets
  open: ['warning', 'Open'], in_progress: ['info', 'In progress'], resolved: ['success', 'Resolved'], closed: ['neutral', 'Closed'],
  // feedback
  new: ['primary', 'New'], reviewed: ['info', 'Reviewed'],
  // priorities
  low: ['neutral', 'Low'], medium: ['info', 'Medium'], high: ['danger', 'High'],
};
export function StatusBadge({ status, label, className }) {
  const [tone, text] = STATUS[status] || ['neutral', status];
  return <Badge tone={tone} className={className}>{label || text}</Badge>;
}

export function Spinner({ className, label = 'Loading' }) {
  return <span role="status" className={cn('inline-flex', className)}><Loader2 className="size-5 animate-spin text-primary" aria-hidden /><span className="sr-only">{label}</span></span>;
}
export function PageLoader({ label = 'Loading…' }) {
  return <div className="grid place-items-center py-24 text-muted gap-2"><Spinner className="[&>svg]:size-8" /><span className="text-sm">{label}</span></div>;
}
export const Skeleton = ({ className }) => <div aria-hidden className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
export function SkeletonCards({ n = 3, className = 'h-40' }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className={className} />)}</div>;
}

export function EmptyState({ icon: Icon = Inbox, title, text, action, className }) {
  return (
    <div className={cn('grid place-items-center text-center py-14 px-6', className)}>
      <div className="size-14 rounded-2xl bg-primary-soft text-primary-text grid place-items-center mb-4"><Icon className="size-7" aria-hidden /></div>
      <h3 className="text-base font-bold">{title}</h3>
      {text && <p className="text-sm text-muted mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="card p-8 text-center">
      <AlertTriangle className="size-8 mx-auto text-danger mb-3" aria-hidden />
      <p className="font-semibold">Couldn’t load this content</p>
      <p className="text-sm text-muted mt-1">{errorMessage(error)}</p>
      {onRetry && <Button variant="secondary" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Alert({ tone = 'info', title, children, className }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', TONES[tone])}>
      <Icon className="size-5 shrink-0 mt-0.5" aria-hidden />
      <div className={className}>{title && <p className="font-semibold">{title}</p>}{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl sm:text-3xl font-extrabold">{title}</h1>
        {subtitle && <p className="text-muted mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const STAT_TONES = { primary: 'bg-primary-soft text-primary-text', success: 'bg-success-soft text-success-text', warning: 'bg-warning-soft text-warning-text', danger: 'bg-danger-soft text-danger-text', info: 'bg-info-soft text-info-text' };
export function StatCard({ label, value, icon: Icon, tone = 'primary', hint, format, to }) {
  const ref = useCountUp(value, format ? { format } : undefined);
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted">{label}</p>
        {Icon && <span className={cn('size-9 rounded-xl grid place-items-center', STAT_TONES[tone])}><Icon className="size-[18px]" aria-hidden /></span>}
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums"><span ref={ref}>{format ? format(value) : fmtNumber(value)}</span></p>
      {hint && <p className="text-[13px] text-muted mt-1">{hint}</p>}
    </>
  );
  const cls = 'card p-5 block transition hover:-translate-y-0.5';
  return to ? <Link to={to} data-reveal className={cls}>{body}</Link> : <div data-reveal className={cls}>{body}</div>;
}

const AV = ['from-indigo-500 to-violet-500', 'from-sky-500 to-cyan-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500', 'from-fuchsia-500 to-purple-500'];
export function Avatar({ name, src, size = 'md', className, square }) {
  const dim = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' }[size];
  const shape = square ? 'rounded-xl' : 'rounded-full';
  if (src) return <img src={assetUrl(src)} alt="" loading="lazy" className={cn(dim, shape, 'object-cover bg-surface-2 border border-line shrink-0', className)} />;
  const hue = AV[[...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
  return <span aria-hidden className={cn(dim, shape, 'grid place-items-center shrink-0 font-bold text-white bg-gradient-to-br', hue, className)}>{initials(name)}</span>;
}

export function ProgressBar({ value, tone = 'primary', label }) {
  const color = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }[tone];
  return (
    <div role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-2 rounded-full bg-surface-2 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className, label = 'Sections' }) {
  const onKey = (e) => {
    const i = tabs.findIndex((t) => t.id === value);
    const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : null;
    if (next) { e.preventDefault(); onChange(next.id); document.getElementById(`tab-${next.id}`)?.focus(); }
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => (
        <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} onClick={() => onChange(t.id)}
          className={cn('px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition', value === t.id ? 'border-primary text-primary-text' : 'border-transparent text-muted hover:text-fg')}>
          {t.label}{t.count !== undefined && <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Pill-shaped single-select filter. */
export function Chips({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        const active = value === opt.value;
        return <button key={opt.value} type="button" aria-pressed={active} onClick={() => onChange(opt.value)}
          className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition', active ? 'bg-primary text-white border-primary' : 'bg-surface border-line text-muted hover:text-fg hover:border-muted')}>{opt.label}</button>;
      })}
    </div>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total } = pagination;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4">
      <p className="text-sm text-muted">Page {page} of {pages} · {fmtNumber(total)} results</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next<ChevronRight className="size-4" aria-hidden /></Button>
      </div>
    </nav>
  );
}

/**
 * Responsive data table. columns: [{ key, header, render?(row), className?, align? }]
 */
export function DataTable({ columns, rows, rowKey = '_id', empty, onRowClick, caption }) {
  if (!rows?.length) return empty || null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
            {columns.map((c) => <th key={c.key} scope="col" className={cn('px-4 py-3 font-semibold whitespace-nowrap', c.align === 'right' && 'text-right', c.className)}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[rowKey]} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('border-b border-line/70 last:border-0 hover:bg-surface-2/60 transition-colors', onRowClick && 'cursor-pointer')}>
              {columns.map((c) => <td key={c.key} className={cn('px-4 py-3 align-middle', c.align === 'right' && 'text-right', c.className)}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dl({ items, className }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {items.filter(Boolean).map(([k, v]) => (<div key={k}><dt className="text-xs uppercase tracking-wide text-muted font-semibold">{k}</dt><dd className="mt-0.5 font-medium break-words">{v || '—'}</dd></div>))}
    </dl>
  );
}

export function CloseButton({ onClick, label = 'Close' }) {
  return <button type="button" onClick={onClick} aria-label={label} className="size-9 grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"><X className="size-5" aria-hidden /></button>;
}
