import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Pencil, Plus, Ruler, Sparkles, Tag, Undo2, X } from 'lucide-react';
import { Button, Card, ConfirmModal, Input, Modal, StatusBadge, Textarea } from '../../components/ui/index.jsx';
import { useForm } from '../../hooks/index.js';
import { errorMessage, fieldErrors, patch, post } from '../../lib/api.js';
import { cn, fmtDate, fmtMoney } from '../../lib/utils.js';
import { KEYS } from './shared.js';

const MAX_SHOWCASE_PRODUCTS = 20;

const refreshBooths = (qc, expoId) => {
  qc.invalidateQueries({ queryKey: ['booths', expoId] });
  qc.invalidateQueries({ queryKey: KEYS.myBooths });
  qc.invalidateQueries({ queryKey: KEYS.dashboard });
};

/** Compact key facts about a booth (code, zone, size, dimensions, price). */
export function BoothFacts({ booth }) {
  const rows = [
    ['Zone', booth.zone || '—', MapPin],
    ['Size', <span className="capitalize">{booth.size}</span>, Tag],
    ['Dimensions', `${booth.w} × ${booth.h} units`, Ruler],
  ];
  return (
    <dl className="grid grid-cols-3 gap-2 text-sm">
      {rows.map(([k, v, Icon]) => (
        <div key={k} className="rounded-xl bg-surface-2 p-2.5">
          <dt className="text-xs text-muted font-semibold flex items-center gap-1"><Icon className="size-3.5" aria-hidden />{k}</dt>
          <dd className="font-bold mt-0.5 truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Product / service tags for a booth showcase (add with Enter, remove with the x). */
function TagInput({ label, tags, onChange, error }) {
  const [text, setText] = useState('');
  const add = () => {
    const value = text.trim();
    if (!value || tags.includes(value) || tags.length >= MAX_SHOWCASE_PRODUCTS) return;
    onChange([...tags, value]);
    setText('');
  };
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <Input label={label} wrapperClassName="flex-1" maxLength={80} value={text} onChange={(e) => setText(e.target.value)} error={error}
          hint={`${tags.length}/${MAX_SHOWCASE_PRODUCTS} added. Press Enter to add.`}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button variant="secondary" icon={Plus} onClick={add} disabled={!text.trim() || tags.length >= MAX_SHOWCASE_PRODUCTS} className="mt-[1.875rem]">Add</Button>
      </div>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-soft text-primary-text pl-3 pr-1 py-1 text-sm font-medium">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))} className="size-6 grid place-items-center rounded-full hover:bg-primary/15"><X className="size-3.5" aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ShowcaseModal({ booth, onClose }) {
  const qc = useQueryClient();
  const form = useForm({ tagline: booth.showcase?.tagline || '', description: booth.showcase?.description || '' });
  const [products, setProducts] = useState(booth.showcase?.products || []);

  const save = useMutation({
    mutationFn: () => patch(`/expos/${booth.expo._id}/booths/${booth._id}/showcase`, { ...form.values, products }),
    onSuccess: () => {
      refreshBooths(qc, booth.expo._id);
      toast.success(`Showcase for booth ${booth.code} updated`);
      onClose();
    },
    onError: (err) => {
      const fields = fieldErrors(err);
      form.setErrors(fields);
      if (!Object.keys(fields).length) toast.error(errorMessage(err));
    },
  });

  return (
    <Modal open onClose={onClose} size="lg" title={`Booth showcase · ${booth.code}`} description="Visitors see this on the floor plan once the organizer confirms your booth."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="showcase-form" icon={Sparkles} loading={save.isPending}>Save showcase</Button></>}>
      <form id="showcase-form" noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Input label="Tagline" maxLength={140} data-autofocus {...form.bind('tagline')} />
        <Textarea label="Description" rows={4} maxLength={1000} hint="What can visitors see, try or learn at your booth?" {...form.bind('description')} />
        <TagInput label="Products & services showcased" tags={products} onChange={setProducts} error={form.errors.products} />
      </form>
    </Modal>
  );
}

export function MyBoothCard({ booth }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const reserved = booth.status === 'reserved';

  const release = useMutation({
    mutationFn: () => post(`/expos/${booth.expo._id}/booths/${booth._id}/release`),
    onSuccess: () => {
      refreshBooths(qc, booth.expo._id);
      toast.success(`Booth ${booth.code} released`);
      setReleasing(false);
    },
    onError: (err) => { toast.error(errorMessage(err)); setReleasing(false); refreshBooths(qc, booth.expo._id); },
  });

  return (
    <Card data-reveal className="p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-extrabold tracking-tight leading-none">{booth.code}</p>
          <p className="text-sm text-muted mt-1.5 truncate">{booth.expo.title}</p>
        </div>
        <StatusBadge status={booth.status} />
      </div>
      <BoothFacts booth={booth} />
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden />Reserved {fmtDate(booth.reservedAt)}</span>
        <span className="font-bold">{fmtMoney(booth.price)}</span>
      </div>
      {reserved && <p className="rounded-xl bg-warning-soft text-warning-text text-[13px] p-3">Waiting for the organizer to confirm this booth.</p>}
      {booth.showcase?.tagline && <p className="text-sm italic text-muted">“{booth.showcase.tagline}”</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit showcase</Button>
        {reserved
          ? <Button variant="ghost" icon={Undo2} className="hover:text-danger" onClick={() => setReleasing(true)}>Release</Button>
          : <p className="text-[13px] text-muted">To cancel a confirmed booth, <Link to="/exhibitor/support" className="font-semibold text-primary-text hover:underline">contact the organizer</Link>.</p>}
      </div>

      {editing && <ShowcaseModal booth={booth} onClose={() => setEditing(false)} />}
      <ConfirmModal open={releasing} onClose={() => setReleasing(false)} loading={release.isPending} title={`Release booth ${booth.code}?`} confirmText="Release booth"
        message="The booth becomes available to other exhibitors straight away. You can reserve it again only if it is still free." onConfirm={() => release.mutate()} />
    </Card>
  );
}

/** Price-sorted list of the booths still available: a keyboard-friendly alternative to the plan. */
export function AvailableList({ booths, selectedId, onSelect }) {
  if (!booths.length) return <p className="text-sm text-muted">No available booths match this filter.</p>;
  return (
    <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
      {booths.map((b) => (
        <li key={b._id}>
          <button type="button" aria-pressed={b._id === selectedId} onClick={() => onSelect(b)}
            className={cn('w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition', b._id === selectedId ? 'border-info bg-info-soft' : 'border-line hover:bg-surface-2')}>
            <span className="font-bold">{b.code}<span className="font-medium text-muted capitalize"> · {b.size}{b.zone ? ` · ${b.zone}` : ''}</span></span>
            <span className="font-semibold tabular-nums">{fmtMoney(b.price)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
