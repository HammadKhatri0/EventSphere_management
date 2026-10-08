import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, FileText, MapPin, Search, Send, Store, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, EmptyState, ErrorState, FileUpload, IconButton, Modal, PageHeader, ProgressBar, SearchInput, Select, SkeletonCards, StatusBadge, Textarea,
} from '../../components/ui/index.jsx';
import { useExpos, useForm } from '../../hooks/index.js';
import { assetUrl, errorMessage, fieldErrors, post } from '../../lib/api.js';
import { fmtNumber, fmtRange } from '../../lib/utils.js';
import { KEYS, useMyApplications, useMyProfile, usePageReveal } from './shared.js';

const MAX_DOCUMENTS = 10;
const SIZE_OPTIONS = [{ value: 'any', label: 'No preference' }, { value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }];
const CLOSED = ['completed', 'cancelled'];

function ApplyModal({ expo, profile, onClose }) {
  const qc = useQueryClient();
  const form = useForm({
    productsServices: (profile.products || []).map((p) => p.name).join(', ').slice(0, 1500),
    message: '', preferredBoothSize: 'any',
  });
  const [documents, setDocuments] = useState([]);

  const apply = useMutation({
    mutationFn: () => post('/applications', { expoId: expo._id, ...form.values, ...(documents.length ? { documents } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.applications });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
      toast.success(`Application sent to ${expo.title}. The organizer will review it shortly.`);
      onClose();
    },
    onError: (err) => {
      const fields = fieldErrors(err);
      form.setErrors(fields);
      if (!Object.keys(fields).length) toast.error(errorMessage(err));
      if (err?.response?.status === 409) qc.invalidateQueries({ queryKey: KEYS.applications });
    },
  });

  const submit = (e) => { e.preventDefault(); apply.mutate(); };

  return (
    <Modal open onClose={onClose} size="lg" title={`Apply to exhibit at ${expo.title}`} description="Tell the organizer what you plan to showcase. You can reserve a booth once approved."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="apply-form" icon={Send} loading={apply.isPending}>Submit application</Button></>}>
      <form id="apply-form" onSubmit={submit} noValidate className="space-y-4">
        <Textarea label="Products &amp; services" rows={3} maxLength={1500} data-autofocus hint="What will you present at the expo?" {...form.bind('productsServices')} />
        <Textarea label="Message to the organizer" rows={3} maxLength={1500} hint="Optional. Share goals, special requirements or questions." {...form.bind('message')} />
        <Select label="Preferred booth size" options={SIZE_OPTIONS} {...form.bind('preferredBoothSize')} />
        <div className="space-y-2">
          <p className="text-sm font-semibold">Supporting documents <span className="font-normal text-muted">({documents.length}/{MAX_DOCUMENTS})</span></p>
          {documents.length > 0 && (
            <ul className="space-y-2">
              {documents.map((d) => (
                <li key={d.url} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <FileText className="size-4 text-muted shrink-0" aria-hidden /><span className="truncate flex-1">{d.name}</span>
                  <IconButton label={`Remove ${d.name}`} icon={Trash2} className="size-8 hover:text-danger" onClick={() => setDocuments((list) => list.filter((x) => x.url !== d.url))} />
                </li>
              ))}
            </ul>
          )}
          {documents.length < MAX_DOCUMENTS && <FileUpload kind="document" buttonText="Attach document" hint="PDF or image, up to 5 MB." onChange={(url, up) => url && setDocuments((list) => [...list, { name: up.name, url }])} />}
          {form.errors.documents && <p role="alert" className="text-[13px] text-danger-text">{form.errors.documents}</p>}
        </div>
      </form>
    </Modal>
  );
}

function ExpoCard({ expo, application, canApply, onApply }) {
  const stats = expo.stats || {};
  const taken = (stats.booked || 0) + (stats.reserved || 0);
  const occupancy = stats.booths ? (taken / stats.booths) * 100 : 0;
  const reapply = application && ['rejected', 'withdrawn'].includes(application.status);
  const holdsSlot = application && !reapply;

  return (
    <Card data-reveal className="overflow-hidden flex flex-col">
      <div className="relative h-36 bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500">
        {expo.banner && <img src={assetUrl(expo.banner)} alt="" loading="lazy" className="size-full object-cover" />}
        <div className="absolute inset-x-0 top-0 p-3 flex justify-between gap-2">
          {expo.status === 'ongoing' ? <StatusBadge status="ongoing" className="bg-surface" /> : <span />}
          {application && <span className="rounded-full bg-surface p-0.5"><StatusBadge status={application.status} /></span>}
        </div>
      </div>
      <div className="p-5 flex flex-col gap-4 flex-1">
        <div>
          <h2 className="text-lg font-bold leading-snug">{expo.title}</h2>
          {expo.theme && <p className="text-sm text-primary-text font-medium mt-0.5">{expo.theme}</p>}
        </div>
        <ul className="space-y-1.5 text-sm text-muted">
          <li className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0" aria-hidden />{fmtRange(expo.startDate, expo.endDate)}</li>
          <li className="flex items-center gap-2"><MapPin className="size-4 shrink-0" aria-hidden />{[expo.location?.venue, expo.location?.city].filter(Boolean).join(', ')}</li>
        </ul>
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="font-semibold flex items-center gap-1.5"><Store className="size-4 text-muted" aria-hidden />Booths</span>
            <span className="text-muted"><span className="font-bold text-fg">{fmtNumber(stats.available)}</span> of {fmtNumber(stats.booths)} available</span>
          </div>
          <ProgressBar value={occupancy} tone={occupancy > 85 ? 'warning' : 'primary'} label={`${Math.round(occupancy)}% of booths taken`} />
        </div>
        {expo.categories?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{expo.categories.slice(0, 4).map((c) => <Badge key={c} tone="neutral">{c}</Badge>)}</div>
        )}
        <div className="mt-auto pt-1">
          {application?.status === 'approved' && <Button to={`/exhibitor/booths?expo=${expo._id}`} className="w-full" icon={Store}>Reserve a booth</Button>}
          {application?.status === 'pending' && <Button to="/exhibitor/applications" variant="secondary" className="w-full">View application</Button>}
          {!holdsSlot && <Button className="w-full" icon={Send} disabled={!canApply} onClick={() => onApply(expo)}>{reapply ? 'Apply again' : 'Apply to exhibit'}</Button>}
        </div>
      </div>
    </Card>
  );
}

export default function Expos() {
  const [search, setSearch] = useState('');
  const [applying, setApplying] = useState(null);
  const expos = useExpos({ upcoming: true });
  const applications = useMyApplications();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const ref = usePageReveal(expos.data && applications.data);

  const byExpo = useMemo(() => new Map((applications.data || []).map((a) => [a.expo._id, a])), [applications.data]);
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (expos.data?.items || [])
      .filter((e) => !CLOSED.includes(e.status))
      .filter((e) => !q || [e.title, e.theme, e.location?.city, e.location?.venue].some((v) => v?.toLowerCase().includes(q)));
  }, [expos.data, search]);

  const profileReady = !!profile?.companyName;
  const loading = expos.isLoading || applications.isLoading;
  const error = expos.error || applications.error;

  return (
    <div ref={ref}>
      <PageHeader title="Find expos & apply" subtitle="Discover upcoming expos that are open to exhibitors and send your application." />

      {!profileLoading && !profileReady && (
        <div className="mb-6" data-reveal>
          <Alert tone="warning" title="Complete your company profile before applying">
            Organizers review your profile with every application. <Link to="/exhibitor/profile" className="font-semibold underline">Go to company profile</Link>
          </Alert>
        </div>
      )}

      <SearchInput value={search} onChange={setSearch} placeholder="Search expos by name, theme or city" className="max-w-md mb-6" />

      {loading && <SkeletonCards n={3} className="h-96" />}
      {error && <ErrorState error={error} onRetry={() => { expos.refetch(); applications.refetch(); }} />}
      {!loading && !error && items.length === 0 && (
        <Card><EmptyState icon={Search} title={search ? 'No expos match your search' : 'No upcoming expos right now'} text={search ? 'Try a different keyword.' : 'Check back soon. New expos are published regularly.'} /></Card>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((expo) => <ExpoCard key={expo._id} expo={expo} application={byExpo.get(expo._id)} canApply={profileReady} onApply={setApplying} />)}
        </div>
      )}

      {applying && profile && <ApplyModal expo={applying} profile={profile} onClose={() => setApplying(null)} />}
    </div>
  );
}
