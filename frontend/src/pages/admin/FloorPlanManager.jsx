import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, CheckCircle2, Grid3x3, LayoutGrid, Plus, Save, Trash2, Undo2, UserCheck } from 'lucide-react';
import { del, errorMessage, fieldErrors, get, patch, post } from '../../lib/api.js';
import { fmtMoney, timeAgo } from '../../lib/utils.js';
import { useForm, useLiveBooths, useReveal } from '../../hooks/index.js';
import FloorPlan from '../../components/FloorPlan.jsx';
import {
  Alert, Avatar, Button, Card, CardHeader, CloseButton, ConfirmModal, Dl, EmptyState, ErrorState, Input, Modal, PageLoader, ProgressBar, Select, StatusBadge,
} from '../../components/ui/index.jsx';
import { ExpoScope } from './shared.jsx';

const SIZE_OPTIONS = [{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }];
const VERBS = { post, patch, del };
const STATUS_TILES = [
  { status: 'available', label: 'Available', tone: 'border-success' },
  { status: 'reserved', label: 'Pending', tone: 'border-warning' },
  { status: 'booked', label: 'Confirmed', tone: 'border-danger' },
  { status: 'blocked', label: 'Blocked', tone: 'border-muted' },
];

export default function FloorPlanManager() {
  const [dialog, setDialog] = useState(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  return (
    <ExpoScope title="Floor plan & booths" subtitle="Lay out booths, move them by dragging and handle reservations in real time."
      actions={(
        <>
          <Button variant="secondary" icon={Grid3x3} onClick={() => setDialog('grid')}>Generate grid</Button>
          <Button icon={Plus} onClick={() => setDialog('add')}>Add booth</Button>
        </>
      )}>
      {(expo) => <Manager key={expo._id} expo={expo} dialog={dialog} onCloseDialog={closeDialog} />}
    </ExpoScope>
  );
}

/** Booth API calls for one expo; every success refreshes the booth list. */
function useBoothActions(expoId) {
  const qc = useQueryClient();
  const key = ['booths', expoId];
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['approved-exhibitors', expoId] });
    qc.invalidateQueries({ queryKey: ['analytics'] });
    qc.invalidateQueries({ queryKey: ['expos'] });
  };

  const run = useMutation({
    mutationFn: ({ verb, boothId, action, body }) => VERBS[verb](`/expos/${expoId}/booths${boothId ? `/${boothId}` : ''}${action ? `/${action}` : ''}`, body),
  });
  const act = (verb, boothId, action, body, { success, onDone, onError } = {}) => run.mutate({ verb, boothId, action, body }, {
    onSuccess: (res) => { if (success) toast.success(success); refresh(); onDone?.(res); },
    onError: (err) => (onError ? onError(err) : toast.error(errorMessage(err))),
  });

  const move = useMutation({
    mutationFn: ({ booth, pos }) => patch(`/expos/${expoId}/booths/${booth._id}`, pos),
    onMutate: async ({ booth, pos }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (old) => old && { ...old, booths: old.booths.map((b) => (b._id === booth._id ? { ...b, ...pos } : b)) });
      return { previous };
    },
    onError: (err, _v, ctx) => { qc.setQueryData(key, ctx?.previous); toast.error(errorMessage(err)); },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { act, busy: run.isPending, move: (booth, pos) => move.mutate({ booth, pos }) };
}

function Manager({ expo, dialog, onCloseDialog }) {
  const expoId = expo._id;
  const { data, isLoading, isError, error, refetch } = useLiveBooths(expoId);
  const { act, busy, move } = useBoothActions(expoId);
  const [selectedId, setSelectedId] = useState(null);
  const booths = data?.booths;

  const counts = useMemo(() => (booths || []).reduce((m, b) => ({ ...m, [b.status]: (m[b.status] || 0) + 1 }), { available: 0, reserved: 0, booked: 0, blocked: 0 }), [booths]);
  const pending = useMemo(() => (booths || []).filter((b) => b.status === 'reserved').sort((a, b) => new Date(a.reservedAt || 0) - new Date(b.reservedAt || 0)), [booths]);
  const selected = booths?.find((b) => b._id === selectedId);
  const ref = useReveal('[data-reveal]', [!!data]);

  if (isLoading) return <PageLoader label="Loading floor plan…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const total = booths.length;
  const occupancy = total ? Math.round(((counts.reserved + counts.booked) / total) * 100) : 0;

  return (
    <div ref={ref}>
      <Card data-reveal className="p-5 mb-6">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {STATUS_TILES.map((t) => (
            <div key={t.status} className={`rounded-xl bg-surface-2 border-l-4 px-4 py-2.5 ${t.tone}`}>
              <p className="text-2xl font-extrabold tabular-nums">{counts[t.status]}</p>
              <p className="text-sm text-muted font-medium">{t.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1.5"><span className="font-semibold">Occupancy</span><span className="text-muted tabular-nums">{counts.reserved + counts.booked} of {total} booths · {occupancy}%</span></div>
          <ProgressBar value={occupancy} label="Booth occupancy" tone={occupancy >= 90 ? 'warning' : 'primary'} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] items-start">
        <Card data-reveal className="p-4 sm:p-5">
          {!total && (
            <div className="mb-4"><Alert tone="info" title="No booths yet">Generate a grid of booths or add them one at a time using the buttons above.</Alert></div>
          )}
          <FloorPlan mode="admin" showPrice floorPlan={data.floorPlan} booths={booths} selectedId={selectedId} label={`Floor plan for ${expo.title}`}
            onSelect={(b) => setSelectedId(b._id)} onMove={move} />
        </Card>

        <div className="space-y-6 xl:sticky xl:top-20">
          {selected ? (
            <BoothPanel key={selected._id} booth={selected} expoId={expoId} act={act} busy={busy} onClose={() => setSelectedId(null)} />
          ) : (
            <Card data-reveal><EmptyState icon={LayoutGrid} title="Select a booth" text="Click a booth on the plan to edit it, confirm a reservation or assign it to an exhibitor." className="py-10" /></Card>
          )}
          <PendingList booths={pending} act={act} busy={busy} onSelect={setSelectedId} />
        </div>
      </div>

      {dialog === 'add' && <AddBoothModal floorPlan={data.floorPlan} booths={booths} expoId={expoId} onClose={onCloseDialog} onCreated={(b) => setSelectedId(b._id)} />}
      {dialog === 'grid' && <GridModal floorPlan={data.floorPlan} expoId={expoId} onClose={onCloseDialog} />}
    </div>
  );
}

function PendingList({ booths, act, busy, onSelect }) {
  return (
    <Card data-reveal>
      <CardHeader title="Pending reservations" subtitle={booths.length ? `${booths.length} waiting for your decision` : undefined} />
      <div className="p-5">
        {!booths.length ? <p className="text-sm text-muted text-center py-4">No reservations are waiting.</p> : (
          <ul className="divide-y divide-line">
            {booths.map((b) => (
              <li key={b._id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <Avatar name={b.exhibitor?.companyName} src={b.exhibitor?.logo} size="sm" />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => onSelect(b._id)} className="font-semibold hover:underline text-left">Booth {b.code}</button>
                    <p className="text-[13px] text-muted truncate">{b.exhibitor?.companyName || 'Exhibitor'}{b.reservedAt && ` · ${timeAgo(b.reservedAt)}`}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2.5">
                  <Button size="sm" variant="success" icon={CheckCircle2} disabled={busy} aria-label={`Confirm booth ${b.code}`}
                    onClick={() => act('post', b._id, 'confirm', undefined, { success: `Booth ${b.code} confirmed` })}>Confirm</Button>
                  <Button size="sm" variant="secondary" icon={Undo2} disabled={busy} aria-label={`Release booth ${b.code}`}
                    onClick={() => act('post', b._id, 'release', undefined, { success: `Booth ${b.code} released` })}>Release</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function BoothPanel({ booth, expoId, act, busy, onClose }) {
  const [confirm, setConfirm] = useState(null);
  const cancelConfirm = useCallback(() => setConfirm(null), []);
  const [assignee, setAssignee] = useState('');
  const { values, bind, setErrors } = useForm({
    code: booth.code, zone: booth.zone || '', size: booth.size, price: String(booth.price ?? 0), w: String(booth.w), h: String(booth.h),
  });
  const holdable = ['available', 'reserved'].includes(booth.status);
  const exhibitors = useQuery({
    queryKey: ['approved-exhibitors', expoId],
    queryFn: () => get(`/expos/${expoId}/approved-exhibitors`),
    enabled: holdable,
  });

  const save = (e) => {
    e.preventDefault();
    act('patch', booth._id, undefined, {
      code: values.code.trim(), zone: values.zone.trim(), size: values.size, price: Number(values.price), w: Number(values.w), h: Number(values.h),
    }, {
      success: `Booth ${values.code.trim()} saved`,
      onError: (err) => { const fe = fieldErrors(err); if (Object.keys(fe).length) setErrors(fe); else toast.error(errorMessage(err)); },
    });
  };
  const release = () => act('post', booth._id, 'release', undefined, { success: `Booth ${booth.code} released`, onDone: cancelConfirm });
  const remove = () => act('del', booth._id, undefined, undefined, { success: `Booth ${booth.code} deleted`, onDone: () => { cancelConfirm(); onClose(); } });
  const exhibitorName = booth.exhibitor?.companyName;

  return (
    <Card data-reveal>
      <div className="flex items-start justify-between gap-3 p-5 pb-0">
        <div>
          <h2 className="text-lg font-bold">Booth {booth.code}</h2>
          <div className="mt-1.5"><StatusBadge status={booth.status} /></div>
        </div>
        <CloseButton onClick={onClose} label="Close booth details" />
      </div>

      <div className="p-5 space-y-5">
        <Dl items={[
          ['Exhibitor', exhibitorName],
          booth.reservedAt && ['Reserved', timeAgo(booth.reservedAt)],
          ['Position', `Column ${booth.x}, row ${booth.y}`],
          ['Price', fmtMoney(booth.price)],
        ]} />

        <form onSubmit={save} className="grid grid-cols-2 gap-3 border-t border-line pt-5" aria-label={`Edit booth ${booth.code}`}>
          <Input label="Code" required maxLength={12} {...bind('code')} />
          <Input label="Zone" maxLength={40} {...bind('zone')} />
          <Select label="Size" options={SIZE_OPTIONS} {...bind('size')} />
          <Input label="Price (USD)" type="number" min={0} {...bind('price')} />
          <Input label="Width (cells)" type="number" min={1} max={20} {...bind('w')} />
          <Input label="Height (cells)" type="number" min={1} max={20} {...bind('h')} />
          <Button type="submit" variant="secondary" icon={Save} loading={busy} className="col-span-2">Save changes</Button>
        </form>

        <div className="border-t border-line pt-5 space-y-3">
          <h3 className="text-sm font-bold">Actions</h3>
          {booth.status === 'reserved' && (
            <Button className="w-full" variant="success" icon={CheckCircle2} disabled={busy}
              onClick={() => act('post', booth._id, 'confirm', undefined, { success: `Booth ${booth.code} confirmed` })}>Confirm reservation</Button>
          )}
          {holdable && (
            <div className="space-y-2">
              <Select label="Assign to exhibitor" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder={exhibitors.isLoading ? 'Loading exhibitors…' : 'Choose an approved exhibitor'}
                hint={exhibitors.isSuccess && !exhibitors.data.items.length ? 'No exhibitor has an approved application for this expo yet.' : undefined}
                options={(exhibitors.data?.items || []).map((x) => ({ value: x.userId, label: `${x.companyName || 'Unnamed company'}${x.booths.length ? ` (holds ${x.booths.map((b) => b.code).join(', ')})` : ''}` }))} />
              <Button className="w-full" variant="soft" icon={UserCheck} disabled={!assignee || busy}
                onClick={() => act('post', booth._id, 'assign', { exhibitorId: assignee }, { success: `Booth ${booth.code} assigned`, onDone: () => setAssignee('') })}>Assign and confirm</Button>
            </div>
          )}
          {['reserved', 'booked'].includes(booth.status) && (
            <Button className="w-full" variant="secondary" icon={Undo2} disabled={busy} onClick={() => setConfirm('release')}>Release from exhibitor</Button>
          )}
          {booth.status === 'available' && (
            <Button className="w-full" variant="secondary" icon={Ban} disabled={busy}
              onClick={() => act('patch', booth._id, undefined, { status: 'blocked' }, { success: `Booth ${booth.code} blocked` })}>Block booth</Button>
          )}
          {booth.status === 'blocked' && (
            <Button className="w-full" variant="secondary" icon={CheckCircle2} disabled={busy}
              onClick={() => act('patch', booth._id, undefined, { status: 'available' }, { success: `Booth ${booth.code} is available again` })}>Unblock booth</Button>
          )}
          <Button className="w-full" variant="ghost" icon={Trash2} disabled={busy || !!booth.exhibitor} onClick={() => setConfirm('delete')}>Delete booth</Button>
          {booth.exhibitor && <p className="text-[13px] text-muted">Release the booth from its exhibitor before deleting it.</p>}
        </div>
      </div>

      <ConfirmModal open={confirm === 'release'} onClose={cancelConfirm} loading={busy} onConfirm={release} confirmText="Release booth"
        title={`Release booth ${booth.code}?`} message={`${exhibitorName || 'The exhibitor'} loses this booth and is notified. It becomes available for others to reserve.`} />
      <ConfirmModal open={confirm === 'delete'} onClose={cancelConfirm} loading={busy} onConfirm={remove} confirmText="Delete booth"
        title={`Delete booth ${booth.code}?`} message="The booth is removed from the floor plan for everyone. This cannot be undone." />
    </Card>
  );
}

const num = (v) => (v === '' ? NaN : Number(v));
const isInt = (v, min, max) => Number.isInteger(num(v)) && num(v) >= min && num(v) <= max;

function AddBoothModal({ floorPlan, booths, expoId, onClose, onCreated }) {
  const qc = useQueryClient();
  const { values, bind, setErrors } = useForm({ code: `B${booths.length + 1}`, x: '0', y: '0', w: '2', h: '2', size: 'small', price: '0', zone: '' });
  const [formError, setFormError] = useState('');

  const create = useMutation({
    mutationFn: (body) => post(`/expos/${expoId}/booths`, body),
    onSuccess: (res) => {
      toast.success(`Booth ${res.data.booth.code} added`);
      qc.invalidateQueries({ queryKey: ['booths', expoId] });
      onCreated(res.data.booth);
      onClose();
    },
    onError: (err) => {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe); else setFormError(errorMessage(err));
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setFormError('');
    const problems = {};
    if (!values.code.trim()) problems.code = 'Enter a booth code';
    ['x', 'y'].forEach((k) => { if (!isInt(values[k], 0, 100)) problems[k] = 'Whole number, 0 or more'; });
    ['w', 'h'].forEach((k) => { if (!isInt(values[k], 1, 20)) problems[k] = 'Whole number, 1 to 20'; });
    if (!(num(values.price) >= 0)) problems.price = 'Enter 0 or more';
    if (!problems.x && !problems.w && num(values.x) + num(values.w) > floorPlan.cols) problems.x = `Must fit inside ${floorPlan.cols} columns`;
    if (!problems.y && !problems.h && num(values.y) + num(values.h) > floorPlan.rows) problems.y = `Must fit inside ${floorPlan.rows} rows`;
    setErrors(problems);
    if (Object.keys(problems).length) return;
    create.mutate({ code: values.code.trim(), x: num(values.x), y: num(values.y), w: num(values.w), h: num(values.h), size: values.size, price: num(values.price), zone: values.zone.trim() });
  };

  return (
    <Modal open onClose={onClose} title="Add a booth" description={`The floor plan is ${floorPlan.cols} × ${floorPlan.rows} cells. Position is the top-left cell.`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="add-booth-form" icon={Plus} loading={create.isPending}>Add booth</Button></>}>
      <form id="add-booth-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {formError && <div className="sm:col-span-2"><Alert tone="danger">{formError}</Alert></div>}
        <Input label="Code" required maxLength={12} data-autofocus {...bind('code')} />
        <Input label="Zone" maxLength={40} hint="Optional, e.g. Hall A" {...bind('zone')} />
        <Input label="Column (x)" type="number" min={0} {...bind('x')} />
        <Input label="Row (y)" type="number" min={0} {...bind('y')} />
        <Input label="Width (cells)" type="number" min={1} max={20} {...bind('w')} />
        <Input label="Height (cells)" type="number" min={1} max={20} {...bind('h')} />
        <Select label="Size" options={SIZE_OPTIONS} {...bind('size')} />
        <Input label="Price (USD)" type="number" min={0} {...bind('price')} />
      </form>
    </Modal>
  );
}

function GridModal({ floorPlan, expoId, onClose }) {
  const qc = useQueryClient();
  const { values, bind, setErrors } = useForm({
    rows: '3', cols: '6', startX: '1', startY: '1', w: '2', h: '2', gapX: '1', gapY: '1', prefix: 'A', size: 'small', price: '0', zone: '',
  });
  const [formError, setFormError] = useState('');

  const rows = num(values.rows); const cols = num(values.cols); const w = num(values.w); const h = num(values.h);
  const needX = num(values.startX) + cols * w + (cols - 1) * num(values.gapX);
  const needY = num(values.startY) + rows * h + (rows - 1) * num(values.gapY);
  const count = rows * cols;
  const fits = needX <= floorPlan.cols && needY <= floorPlan.rows;

  const generate = useMutation({
    mutationFn: (body) => post(`/expos/${expoId}/booths/bulk`, body),
    onSuccess: (res) => {
      toast.success(`${res.data.count} booths created`);
      qc.invalidateQueries({ queryKey: ['booths', expoId] });
      qc.invalidateQueries({ queryKey: ['expos'] });
      onClose();
    },
    onError: (err) => {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe); else setFormError(errorMessage(err));
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setFormError('');
    const problems = {};
    [['rows', 1, 30], ['cols', 1, 30], ['startX', 0, 100], ['startY', 0, 100], ['w', 1, 10], ['h', 1, 10], ['gapX', 0, 10], ['gapY', 0, 10]].forEach(([k, min, max]) => {
      if (!isInt(values[k], min, max)) problems[k] = `Whole number, ${min} to ${max}`;
    });
    if (!values.prefix.trim()) problems.prefix = 'Enter a code prefix';
    if (!(num(values.price) >= 0)) problems.price = 'Enter 0 or more';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    generate.mutate({
      rows, cols, startX: num(values.startX), startY: num(values.startY), w, h, gapX: num(values.gapX), gapY: num(values.gapY),
      prefix: values.prefix.trim(), size: values.size, price: num(values.price), zone: values.zone.trim(),
    });
  };

  return (
    <Modal open onClose={onClose} size="lg" title="Generate a booth grid" description="Create many evenly spaced booths at once. Codes are numbered from the prefix, e.g. A1, A2, A3…"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="grid-form" icon={Grid3x3} loading={generate.isPending}>Create booths</Button></>}>
      <form id="grid-form" onSubmit={submit} noValidate className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {formError && <div className="col-span-full"><Alert tone="danger">{formError}</Alert></div>}
        <Input label="Rows" type="number" min={1} max={30} data-autofocus {...bind('rows')} />
        <Input label="Columns" type="number" min={1} max={30} {...bind('cols')} />
        <Input label="Start column (x)" type="number" min={0} {...bind('startX')} />
        <Input label="Start row (y)" type="number" min={0} {...bind('startY')} />
        <Input label="Booth width" type="number" min={1} max={10} {...bind('w')} />
        <Input label="Booth height" type="number" min={1} max={10} {...bind('h')} />
        <Input label="Horizontal gap" type="number" min={0} max={10} {...bind('gapX')} />
        <Input label="Vertical gap" type="number" min={0} max={10} {...bind('gapY')} />
        <Input label="Code prefix" maxLength={4} {...bind('prefix')} />
        <Select label="Size" options={SIZE_OPTIONS} {...bind('size')} />
        <Input label="Price (USD)" type="number" min={0} {...bind('price')} />
        <Input label="Zone" maxLength={40} {...bind('zone')} />
        <div className="col-span-full">
          {Number.isFinite(count) && count > 0 && (fits
            ? <Alert tone="success" title={`${count} booths will be created`}>They occupy {needX} columns and {needY} rows of the ${floorPlan.cols} × ${floorPlan.rows} floor plan.</Alert>
            : <Alert tone="warning" title="The grid does not fit">It needs {needX} columns and {needY} rows, but the floor plan is {floorPlan.cols} × {floorPlan.rows}. Reduce the rows, columns or gaps, or enlarge the floor plan in the expo settings.</Alert>)}
        </div>
      </form>
    </Modal>
  );
}
