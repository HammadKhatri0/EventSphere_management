import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bookmark, CalendarClock, Clock, MapPin, Mic2, Pencil, Plus, Save, Trash2, UserPlus, X } from 'lucide-react';
import { del, errorMessage, fieldErrors, get, patch, post } from '../../lib/api.js';
import { cn, fmtDay, fmtTime, groupBy, localDay, toLocalInput } from '../../lib/utils.js';
import { useExpoRoom, useForm, useReveal, useSocketEvent } from '../../hooks/index.js';
import {
  Alert, Badge, Button, Card, Chips, ConfirmModal, EmptyState, ErrorState, IconButton, Input, Modal, PageLoader, ProgressBar, SearchInput, Select, Textarea,
} from '../../components/ui/index.jsx';
import { ExpoScope, useMeta } from './shared.jsx';

const TYPE_TONE = { keynote: 'primary', talk: 'info', workshop: 'success', panel: 'warning', networking: 'neutral' };
const DEFAULT_TYPES = ['keynote', 'talk', 'workshop', 'panel', 'networking'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const EMPTY_SPEAKER = { name: '', title: '', company: '', bio: '' };

export default function Schedule() {
  const [editing, setEditing] = useState(null); // 'new' | session
  const closeEditor = useCallback(() => setEditing(null), []);
  return (
    <ExpoScope title="Schedule & sessions" subtitle="Plan keynotes, talks and workshops. Attendees are notified when a session moves or is cancelled."
      actions={<Button icon={Plus} onClick={() => setEditing('new')}>New session</Button>}>
      {(expo) => <Body key={expo._id} expo={expo} editing={editing} setEditing={setEditing} closeEditor={closeEditor} />}
    </ExpoScope>
  );
}

function Body({ expo, editing, setEditing, closeEditor }) {
  const expoId = expo._id;
  const qc = useQueryClient();
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const cancelDelete = useCallback(() => setToDelete(null), []);

  useExpoRoom(expoId);
  useSocketEvent('schedule:updated', (p) => { if (!p?.expoId || String(p.expoId) === expoId) qc.invalidateQueries({ queryKey: ['sessions', expoId] }); });
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['sessions', expoId], queryFn: () => get(`/expos/${expoId}/sessions`) });

  const items = data?.items;
  const types = useMemo(() => [...new Set((items || []).map((s) => s.type))], [items]);
  const rooms = useMemo(() => [...new Set((items || []).map((s) => s.location))].sort(), [items]);
  const days = useMemo(() => {
    const q = search.trim().toLowerCase();
    const shown = (items || []).filter((s) => (type === 'all' || s.type === type)
      && (!q || [s.title, s.topic, s.location, ...s.speakers.map((x) => x.name)].some((v) => v?.toLowerCase().includes(q))));
    return Object.entries(groupBy(shown, (s) => localDay(s.startTime))).sort(([a], [b]) => a.localeCompare(b));
  }, [items, type, search]);
  const ref = useReveal('[data-reveal]', [!!items, type, search]);

  const remove = useMutation({
    mutationFn: (s) => del(`/sessions/${s._id}`),
    onSuccess: (_r, s) => { toast.success(`“${s.title}” was deleted`); cancelDelete(); qc.invalidateQueries({ queryKey: ['sessions', expoId] }); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <PageLoader label="Loading schedule…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <>
      {!!items.length && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search title, speaker or room" className="w-full sm:w-80" />
          <Chips label="Filter by session type" value={type} onChange={setType}
            options={[{ value: 'all', label: `All (${items.length})` }, ...types.map((t) => ({ value: t, label: `${cap(t)} (${items.filter((s) => s.type === t).length})` }))]} />
        </div>
      )}

      <div ref={ref} className="space-y-8">
        {!items.length ? (
          <Card><EmptyState icon={CalendarClock} title="No sessions scheduled" text={`Add the first session for ${expo.title}.`} action={<Button icon={Plus} onClick={() => setEditing('new')}>New session</Button>} /></Card>
        ) : !days.length ? (
          <Card><EmptyState title="No sessions match your filters" action={<Button variant="secondary" onClick={() => { setType('all'); setSearch(''); }}>Clear filters</Button>} /></Card>
        ) : days.map(([day, list]) => (
          <section key={day} aria-labelledby={`day-${day}`}>
            <h2 id={`day-${day}`} data-reveal className="text-lg font-bold mb-3">{fmtDay(list[0].startTime)} <span className="text-sm font-medium text-muted">· {list.length} session{list.length === 1 ? '' : 's'}</span></h2>
            <ul className="space-y-3">
              {list.map((s) => <SessionRow key={s._id} session={s} onEdit={() => setEditing(s)} onDelete={() => setToDelete(s)} />)}
            </ul>
          </section>
        ))}
      </div>

      {editing && <SessionModal expo={expo} session={editing === 'new' ? null : editing} rooms={rooms} onClose={closeEditor} />}
      <ConfirmModal open={!!toDelete} onClose={cancelDelete} loading={remove.isPending} onConfirm={() => remove.mutate(toDelete)} confirmText="Delete session"
        title={`Delete “${toDelete?.title}”?`}
        message={`${(toDelete?.registeredCount || 0) + (toDelete?.bookmarkCount || 0)} attendee(s) registered or bookmarked this session. They will be notified that it was cancelled and it disappears from their agenda.`} />
    </>
  );
}

function SessionRow({ session: s, onEdit, onDelete }) {
  const full = s.capacity > 0 && s.registeredCount >= s.capacity;
  const pct = s.capacity > 0 ? Math.round((s.registeredCount / s.capacity) * 100) : 0;
  return (
    <li data-reveal className="card p-4 sm:p-5 grid gap-4 sm:grid-cols-[7.5rem_minmax(0,1fr)_14rem] items-start">
      <div className="text-sm">
        <p className="font-bold flex items-center gap-1.5"><Clock className="size-4 text-muted" aria-hidden />{fmtTime(s.startTime)}</p>
        <p className="text-muted pl-5.5">to {fmtTime(s.endTime)}</p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold">{s.title}</h3>
          <Badge tone={TYPE_TONE[s.type] || 'neutral'}>{cap(s.type)}</Badge>
          {s.topic && <Badge>{s.topic}</Badge>}
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-4 shrink-0" aria-hidden />{s.location}</p>
        {!!s.speakers.length && (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted"><Mic2 className="size-4 shrink-0 mt-0.5" aria-hidden />
            <span>{s.speakers.map((x) => `${x.name}${x.company ? ` (${x.company})` : ''}`).join(', ')}</span></p>
        )}
      </div>

      <div className="flex sm:flex-col gap-3 sm:items-stretch items-center justify-between">
        <div className="flex-1 min-w-0">
          {s.capacity > 0 ? (
            <>
              <div className="flex justify-between text-[13px] mb-1"><span className="font-semibold">{s.registeredCount}/{s.capacity} registered</span><span className={cn('tabular-nums', full ? 'text-danger-text font-semibold' : 'text-muted')}>{full ? 'Full' : `${pct}%`}</span></div>
              <ProgressBar value={pct} tone={pct >= 90 ? 'danger' : 'primary'} label={`Registrations for ${s.title}`} />
            </>
          ) : <p className="text-[13px] font-semibold">{s.registeredCount} registered <span className="font-normal text-muted">· no limit</span></p>}
          <p className="mt-1.5 text-[13px] text-muted flex items-center gap-1"><Bookmark className="size-3.5" aria-hidden />{s.bookmarkCount} saved to agendas</p>
        </div>
        <div className="flex gap-1 shrink-0 sm:justify-end">
          <IconButton label={`Edit ${s.title}`} icon={Pencil} onClick={onEdit} />
          <IconButton label={`Delete ${s.title}`} icon={Trash2} className="hover:text-danger" onClick={onDelete} />
        </div>
      </div>
    </li>
  );
}

function SessionModal({ expo, session, rooms, onClose }) {
  const qc = useQueryClient();
  const meta = useMeta();
  const editing = !!session;
  const day = localDay(expo.startDate);
  const { values, set, bind, errors, setErrors } = useForm({
    title: session?.title || '', description: session?.description || '', topic: session?.topic || '', type: session?.type || 'talk',
    location: session?.location || '', startTime: session ? toLocalInput(session.startTime) : `${day}T09:00`, endTime: session ? toLocalInput(session.endTime) : `${day}T10:00`,
    capacity: String(session?.capacity ?? 0), speakers: (session?.speakers || []).map(({ name, title, company, bio }) => ({ name, title, company, bio })),
  });
  const [conflict, setConflict] = useState('');
  const conflictRef = useRef(null);
  useEffect(() => { if (conflict) conflictRef.current?.scrollIntoView({ block: 'nearest' }); }, [conflict]);

  const save = useMutation({
    mutationFn: (body) => (editing ? patch(`/sessions/${session._id}`, body) : post(`/expos/${expo._id}/sessions`, body)),
    onSuccess: () => {
      toast.success(editing ? 'Session updated' : 'Session created');
      qc.invalidateQueries({ queryKey: ['sessions', expo._id] });
      onClose();
    },
    onError: (err) => {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) { setErrors(fe); setConflict(''); } else if (err.response?.status === 409) setConflict(errorMessage(err)); else toast.error(errorMessage(err));
    },
  });

  const setSpeaker = (i, field, value) => {
    set('speakers', values.speakers.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
    if (errors[`speakers.${i}.${field}`]) setErrors((prev) => ({ ...prev, [`speakers.${i}.${field}`]: undefined }));
  };

  const submit = (e) => {
    e.preventDefault();
    setConflict('');
    const problems = {};
    if (!values.title.trim()) problems.title = 'Enter a title';
    if (!values.location.trim()) problems.location = 'Enter a room or location';
    if (!values.startTime) problems.startTime = 'Choose a start time';
    if (!values.endTime) problems.endTime = 'Choose an end time';
    if (values.startTime && values.endTime && new Date(values.endTime) <= new Date(values.startTime)) problems.endTime = 'End time must be after the start time';
    if (!(Number(values.capacity) >= 0) || values.capacity === '') problems.capacity = 'Enter 0 or more (0 means unlimited)';
    values.speakers.forEach((s, i) => { if (!s.name.trim()) problems[`speakers.${i}.name`] = 'Enter the speaker name'; });
    setErrors(problems);
    if (Object.keys(problems).length) return;
    save.mutate({
      title: values.title.trim(), description: values.description.trim(), topic: values.topic.trim(), type: values.type, location: values.location.trim(),
      startTime: new Date(values.startTime).toISOString(), endTime: new Date(values.endTime).toISOString(), capacity: Number(values.capacity),
      speakers: values.speakers.map((s) => ({ name: s.name.trim(), title: s.title.trim(), company: s.company.trim(), bio: s.bio.trim() })),
    });
  };

  return (
    <Modal open onClose={onClose} size="lg" title={editing ? 'Edit session' : 'New session'} description={expo.title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="session-form" icon={Save} loading={save.isPending}>{editing ? 'Save changes' : 'Create session'}</Button></>}>
      <form id="session-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {conflict && (
          <div ref={conflictRef} className="sm:col-span-2"><Alert tone="danger" title="Schedule conflict">{conflict} Choose another time or room, or change the speakers.</Alert></div>
        )}
        <Input label="Title" required maxLength={140} wrapperClassName="sm:col-span-2" data-autofocus {...bind('title')} />
        <Textarea label="Description" rows={3} maxLength={2000} wrapperClassName="sm:col-span-2" {...bind('description')} />
        <Select label="Type" options={(meta.data?.sessionTypes || DEFAULT_TYPES).map((t) => ({ value: t, label: cap(t) }))} {...bind('type')} />
        <Input label="Topic" maxLength={80} hint="Optional, used for filtering" {...bind('topic')} />
        <Input label="Room / location" required maxLength={80} list="session-rooms" {...bind('location')} />
        <datalist id="session-rooms">{rooms.map((r) => <option key={r} value={r} />)}</datalist>
        <Input label="Capacity" type="number" min={0} hint="0 means unlimited" {...bind('capacity')} />
        <Input label="Starts" type="datetime-local" required {...bind('startTime')} />
        <Input label="Ends" type="datetime-local" required min={values.startTime || undefined} {...bind('endTime')} />

        <fieldset className="sm:col-span-2 space-y-3">
          <legend className="text-sm font-semibold mb-2">Speakers</legend>
          {!values.speakers.length && <p className="text-sm text-muted">No speakers added.</p>}
          {values.speakers.map((s, i) => (
            <div key={i} className="rounded-xl border border-line p-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 flex items-center justify-between">
                <p className="text-sm font-bold">Speaker {i + 1}</p>
                <IconButton label={`Remove speaker ${i + 1}`} icon={X} className="size-8" onClick={() => set('speakers', values.speakers.filter((_, idx) => idx !== i))} />
              </div>
              <Input label="Name" required maxLength={80} value={s.name} error={errors[`speakers.${i}.name`]} onChange={(e) => setSpeaker(i, 'name', e.target.value)} />
              <Input label="Job title" maxLength={80} value={s.title} onChange={(e) => setSpeaker(i, 'title', e.target.value)} />
              <Input label="Company" maxLength={80} value={s.company} onChange={(e) => setSpeaker(i, 'company', e.target.value)} />
              <Textarea label="Bio" rows={2} maxLength={500} value={s.bio} onChange={(e) => setSpeaker(i, 'bio', e.target.value)} />
            </div>
          ))}
          <Button variant="secondary" size="sm" icon={UserPlus} disabled={values.speakers.length >= 10} onClick={() => set('speakers', [...values.speakers, { ...EMPTY_SPEAKER }])}>Add speaker</Button>
        </fieldset>
      </form>
    </Modal>
  );
}
