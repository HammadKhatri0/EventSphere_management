import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import { fieldErrors, errorMessage, get, patch, post } from '../../lib/api.js';
import { cn, localDay } from '../../lib/utils.js';
import { useForm } from '../../hooks/index.js';
import { Alert, Button, Card, CardHeader, ErrorState, FileUpload, Input, PageHeader, PageLoader, Select, Textarea, Toggle } from '../../components/ui/index.jsx';
import { mapErrors, useMeta } from './shared.jsx';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft (hidden from the public)' },
  { value: 'published', label: 'Published' },
  { value: 'ongoing', label: 'Live now' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
const ERROR_ALIASES = {
  venue: 'location.venue', address: 'location.address', city: 'location.city', country: 'location.country',
  cols: 'floorPlan.cols', rows: 'floorPlan.rows',
};

const toValues = (expo) => ({
  title: expo?.title || '', theme: expo?.theme || '', description: expo?.description || '',
  startDate: expo ? localDay(expo.startDate) : '', endDate: expo ? localDay(expo.endDate) : '',
  venue: expo?.location?.venue || '', address: expo?.location?.address || '', city: expo?.location?.city || '', country: expo?.location?.country || '',
  status: expo?.status || 'draft', featured: !!expo?.featured, capacity: String(expo?.capacity ?? 0),
  categories: expo?.categories || [], cols: String(expo?.floorPlan?.cols ?? 24), rows: String(expo?.floorPlan?.rows ?? 14),
  banner: expo?.banner,
});

/** Start of the chosen local day / end of it, so an expo ending today still counts as running today. */
const dayBoundary = (day, end) => new Date(`${day}T${end ? '23:59:00' : '00:00:00'}`).toISOString();

export default function ExpoForm() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ['expo', id], queryFn: () => get(`/expos/${id}`), enabled: !!id });
  const back = <Link to="/admin/expos" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg mb-2"><ArrowLeft className="size-4" aria-hidden />All expos</Link>;

  if (id && query.isLoading) return <><PageHeader title="Edit expo" back={back} /><PageLoader /></>;
  if (id && query.isError) return <><PageHeader title="Edit expo" back={back} /><ErrorState error={query.error} onRetry={query.refetch} /></>;
  return <ExpoFormBody key={id || 'new'} expo={query.data?.expo} back={back} />;
}

function ExpoFormBody({ expo, back }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meta = useMeta();
  const { values, set, bind, errors, setErrors } = useForm(toValues(expo));
  const [formError, setFormError] = useState('');
  const editing = !!expo;

  const save = useMutation({
    mutationFn: (body) => (editing ? patch(`/expos/${expo._id}`, body) : post('/expos', body)),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['expos'] });
      qc.invalidateQueries({ queryKey: ['expo'] });
      if (editing) { toast.success('Expo updated'); navigate('/admin/expos'); return; }
      toast.success('Expo created. Now lay out your floor plan.');
      navigate(`/admin/floor-plan?expo=${res.data.expo._id}`);
    },
    onError: (err) => {
      const fe = mapErrors(fieldErrors(err), ERROR_ALIASES);
      if (Object.keys(fe).length) { setErrors(fe); setFormError('Please fix the highlighted fields.'); } else toast.error(errorMessage(err));
    },
  });

  const validate = () => {
    const e = {};
    if (!values.title.trim()) e.title = 'Enter a title';
    if (!values.venue.trim()) e.venue = 'Enter the venue';
    if (!values.startDate) e.startDate = 'Choose a start date';
    if (!values.endDate) e.endDate = 'Choose an end date';
    if (values.startDate && values.endDate && values.endDate < values.startDate) e.endDate = 'End date must be on or after the start date';
    const num = (v) => (v === '' ? NaN : Number(v));
    if (!(num(values.capacity) >= 0)) e.capacity = 'Enter 0 or more (0 means unlimited)';
    if (!(num(values.cols) >= 4 && num(values.cols) <= 100)) e.cols = 'Between 4 and 100';
    if (!(num(values.rows) >= 4 && num(values.rows) <= 100)) e.rows = 'Between 4 and 100';
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    const problems = validate();
    setErrors(problems);
    if (Object.keys(problems).length) { setFormError('Please fix the highlighted fields.'); return; }
    setFormError('');
    // untouched dates keep their stored time of day
    const dateValue = (field, end) => (expo && values[field] === localDay(expo[field]) ? expo[field] : dayBoundary(values[field], end));
    save.mutate({
      title: values.title.trim(), theme: values.theme.trim(), description: values.description.trim(),
      startDate: dateValue('startDate', false), endDate: dateValue('endDate', true),
      location: { venue: values.venue.trim(), address: values.address.trim(), city: values.city.trim(), country: values.country.trim() },
      status: values.status, featured: values.featured, capacity: Number(values.capacity),
      categories: values.categories, floorPlan: { cols: Number(values.cols), rows: Number(values.rows) },
      banner: values.banner || '',
    });
  };

  const toggleCategory = (c) => set('categories', values.categories.includes(c) ? values.categories.filter((x) => x !== c) : [...values.categories, c]);

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader back={back} title={editing ? `Edit ${expo.title}` : 'Create an expo'}
        subtitle={editing ? 'Update the details attendees and exhibitors see.' : 'Fill in the basics. You can adjust everything later.'} />
      {formError && <div className="mb-5"><Alert tone="danger">{formError}</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <Card data-reveal>
            <CardHeader title="Basics" />
            <div className="p-5 grid gap-4">
              <Input label="Title" required maxLength={140} {...bind('title')} />
              <Input label="Theme" hint="A short tagline shown under the title" maxLength={120} {...bind('theme')} />
              <Textarea label="Description" rows={5} maxLength={4000} {...bind('description')} />
            </div>
          </Card>

          <Card data-reveal>
            <CardHeader title="Dates & venue" />
            <div className="p-5 grid gap-4 sm:grid-cols-2">
              <Input label="Start date" type="date" required {...bind('startDate')} />
              <Input label="End date" type="date" required min={values.startDate || undefined} {...bind('endDate')} />
              <Input label="Venue" required maxLength={140} wrapperClassName="sm:col-span-2" {...bind('venue')} />
              <Input label="Address" maxLength={200} wrapperClassName="sm:col-span-2" {...bind('address')} />
              <Input label="City" maxLength={80} {...bind('city')} />
              <Input label="Country" maxLength={80} {...bind('country')} />
            </div>
          </Card>

          <Card data-reveal>
            <CardHeader title="Categories" subtitle="Help attendees and exhibitors find this expo" />
            <div className="p-5">
              {meta.isLoading ? <p className="text-sm text-muted">Loading categories…</p> : meta.isError ? <p className="text-sm text-danger-text">Could not load categories.</p> : (
                <fieldset>
                  <legend className="sr-only">Expo categories</legend>
                  <div className="flex flex-wrap gap-2">
                    {meta.data.categories.map((c) => {
                      const on = values.categories.includes(c);
                      return (
                        <button key={c} type="button" aria-pressed={on} onClick={() => toggleCategory(c)}
                          className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition', on ? 'bg-primary text-white border-primary' : 'bg-surface border-line text-muted hover:text-fg hover:border-muted')}>{c}</button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              {errors.categories && <p role="alert" className="text-[13px] text-danger-text mt-2">{errors.categories}</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card data-reveal>
            <CardHeader title="Publishing" />
            <div className="p-5 grid gap-4">
              <Select label="Status" options={STATUS_OPTIONS} {...bind('status')} />
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-semibold">Featured on the home page</p><p className="text-[13px] text-muted">Highlights this expo to attendees</p></div>
                <Toggle checked={values.featured} onChange={(v) => set('featured', v)} label="Featured expo" />
              </div>
              <Input label="Attendee capacity" type="number" min={0} hint="0 means unlimited" {...bind('capacity')} />
            </div>
          </Card>

          <Card data-reveal>
            <CardHeader title="Floor plan size" subtitle="Grid cells available for booths" />
            <div className="p-5 grid gap-4 grid-cols-2">
              <Input label="Columns" type="number" min={4} max={100} {...bind('cols')} />
              <Input label="Rows" type="number" min={4} max={100} {...bind('rows')} />
              <p className="col-span-2 text-[13px] text-muted">You will place the booths on the floor plan screen. Shrinking the grid is blocked while booths sit outside it.</p>
            </div>
          </Card>

          <Card data-reveal>
            <CardHeader title="Banner image" />
            <div className="p-5">
              <FileUpload kind="image" value={values.banner} onChange={(url) => set('banner', url)} hint="PNG, JPG or WebP, up to 5 MB. Wide images work best." />
              {errors.banner && <p role="alert" className="text-[13px] text-danger-text mt-2">{errors.banner}</p>}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button to="/admin/expos" variant="secondary">Cancel</Button>
        <Button type="submit" icon={Save} loading={save.isPending}>{editing ? 'Save changes' : 'Create expo'}</Button>
      </div>
    </form>
  );
}
