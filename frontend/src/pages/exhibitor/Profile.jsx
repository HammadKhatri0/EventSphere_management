import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, FileText, Package, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import {
  Alert, Avatar, Button, Card, EmptyState, ErrorState, FileUpload, IconButton, Input, PageHeader, PageLoader, Tabs, Textarea,
} from '../../components/ui/index.jsx';
import { assetUrl, errorMessage, fieldErrors, put } from '../../lib/api.js';
import { cn } from '../../lib/utils.js';
import { KEYS, toProfilePayload, useMeta, useMyProfile, usePageReveal } from './shared.js';

const MAX_CATEGORIES = 8;
const MAX_PRODUCTS = 50;
const MAX_DOCUMENTS = 20;
const TABS = (draft) => [
  { id: 'company', label: 'Company' },
  { id: 'products', label: 'Products', count: draft.products.length },
  { id: 'documents', label: 'Documents', count: draft.documents.length },
];

let keySeq = 0;
const withKey = (item) => ({ ...item, _k: `k${keySeq++}` });
const toDraft = (p) => ({
  companyName: p?.companyName || '', tagline: p?.tagline || '', description: p?.description || '', website: p?.website || '', logo: p?.logo,
  categories: p?.categories || [], contact: { email: p?.contact?.email || '', phone: p?.contact?.phone || '', address: p?.contact?.address || '' },
  products: (p?.products || []).map(withKey), documents: (p?.documents || []).map(withKey),
});

// Staff are managed on their own page, so the latest saved staff list is always sent along unchanged.
const payloadOf = (draft, profile) => toProfilePayload({ ...draft, staff: profile?.staff });

/** Which tab a server field error (e.g. `products.0.name`) belongs to. */
const tabOf = (field) => (field.startsWith('products') ? 'products' : field.startsWith('documents') ? 'documents' : 'company');

/** Image preview + uploader with remove. */
function ImagePicker({ label, value, onChange, name, hint }) {
  return (
    <div className="flex items-center gap-4">
      {value ? <img src={assetUrl(value)} alt={`${label} preview`} className="size-16 rounded-xl object-cover border border-line bg-surface-2" />
        : <Avatar name={name} size="lg" square />}
      <FileUpload label={label} kind="image" buttonText={value ? 'Replace image' : 'Upload image'} onChange={(url) => onChange(url)} value={value} hint={hint} />
    </div>
  );
}

function CompanyTab({ draft, set, setContact, errors }) {
  const { data: meta } = useMeta();
  const toggle = (cat) => {
    const has = draft.categories.includes(cat);
    if (!has && draft.categories.length >= MAX_CATEGORIES) return toast.error(`Choose at most ${MAX_CATEGORIES} categories`);
    set('categories', has ? draft.categories.filter((c) => c !== cat) : [...draft.categories, cat]);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card data-reveal className="p-5 space-y-5 lg:col-span-2">
        <h2 className="text-base font-bold">About your company</h2>
        <Input label="Company name" required maxLength={120} value={draft.companyName} onChange={(e) => set('companyName', e.target.value)} error={errors.companyName} />
        <Input label="Tagline" maxLength={140} hint="One line that sums up what you do." value={draft.tagline} onChange={(e) => set('tagline', e.target.value)} error={errors.tagline} />
        <Textarea label="Description" rows={6} maxLength={3000} hint={`${draft.description.length}/3000`} value={draft.description} onChange={(e) => set('description', e.target.value)} error={errors.description} />
        <Input label="Website" type="url" placeholder="https://www.example.com" value={draft.website} onChange={(e) => set('website', e.target.value)} error={errors.website} />
        <fieldset>
          <legend className="text-sm font-semibold">Categories <span className="font-normal text-muted">({draft.categories.length}/{MAX_CATEGORIES})</span></legend>
          <div className="flex flex-wrap gap-2 mt-2">
            {(meta?.categories || []).map((cat) => {
              const on = draft.categories.includes(cat);
              return (
                <button key={cat} type="button" aria-pressed={on} onClick={() => toggle(cat)}
                  className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition', on ? 'bg-primary text-white border-primary' : 'bg-surface border-line text-muted hover:text-fg hover:border-muted')}>{cat}</button>
              );
            })}
          </div>
          {errors.categories && <p role="alert" className="text-[13px] text-danger-text mt-1.5">{errors.categories}</p>}
        </fieldset>
      </Card>

      <div className="space-y-6">
        <Card data-reveal className="p-5 space-y-4">
          <h2 className="text-base font-bold">Company logo</h2>
          <ImagePicker label="Logo" name={draft.companyName} value={draft.logo} onChange={(url) => set('logo', url)} hint="PNG, JPG or WebP up to 5 MB." />
          {errors.logo && <p role="alert" className="text-[13px] text-danger-text">{errors.logo}</p>}
        </Card>
        <Card data-reveal className="p-5 space-y-4">
          <h2 className="text-base font-bold">Contact details</h2>
          <Input label="Contact email" type="email" value={draft.contact.email} onChange={(e) => setContact('email', e.target.value)} error={errors['contact.email']} />
          <Input label="Phone" type="tel" value={draft.contact.phone} onChange={(e) => setContact('phone', e.target.value)} error={errors['contact.phone']} />
          <Input label="Address" value={draft.contact.address} onChange={(e) => setContact('address', e.target.value)} error={errors['contact.address']} />
        </Card>
      </div>
    </div>
  );
}

function ProductsTab({ draft, set, errors }) {
  const update = (key, patch) => set('products', draft.products.map((p) => (p._k === key ? { ...p, ...patch } : p)));
  const remove = (key) => set('products', draft.products.filter((p) => p._k !== key));
  const add = () => set('products', [...draft.products, withKey({ name: '', description: '' })]);
  const full = draft.products.length >= MAX_PRODUCTS;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Showcase what you offer. {draft.products.length}/{MAX_PRODUCTS} items.</p>
        <Button variant="secondary" icon={Plus} onClick={add} disabled={full}>Add product</Button>
      </div>
      {draft.products.length === 0 ? (
        <Card data-reveal><EmptyState icon={Package} title="No products yet" text="Add the products and services visitors can discover at your booth."
          action={<Button icon={Plus} onClick={add}>Add your first product</Button>} /></Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {draft.products.map((p, i) => (
            <li key={p._k}>
              <Card data-reveal className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold">Item {i + 1}</h3>
                  <IconButton label={`Remove product ${p.name || i + 1}`} icon={Trash2} className="-m-2 hover:text-danger" onClick={() => remove(p._k)} />
                </div>
                <Input label="Name" required maxLength={100} value={p.name} onChange={(e) => update(p._k, { name: e.target.value })} error={errors[`products.${i}.name`]} />
                <Textarea label="Description" rows={3} maxLength={500} value={p.description || ''} onChange={(e) => update(p._k, { description: e.target.value })} error={errors[`products.${i}.description`]} />
                <ImagePicker label="Image" name={p.name} value={p.image} onChange={(url) => update(p._k, { image: url })} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocumentsTab({ draft, set, errors }) {
  const full = draft.documents.length >= MAX_DOCUMENTS;
  return (
    <Card data-reveal className="p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Brochures &amp; documents</h2>
          <p className="text-sm text-muted">PDF or image files up to 5 MB. {draft.documents.length}/{MAX_DOCUMENTS} uploaded.</p>
        </div>
        {!full && <FileUpload kind="document" buttonText="Upload document" onChange={(url, up) => url && set('documents', [...draft.documents, withKey({ name: up.name, url })])} />}
      </div>
      {errors.documents && <p role="alert" className="text-[13px] text-danger-text">{errors.documents}</p>}
      {draft.documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" text="Upload product sheets, price lists or brochures for visitors and organizers." />
      ) : (
        <ul className="divide-y divide-line">
          {draft.documents.map((d, i) => (
            <li key={d._k} className="flex items-center gap-3 py-3">
              <span className="size-10 rounded-xl bg-primary-soft text-primary-text grid place-items-center shrink-0"><FileText className="size-5" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{d.name || 'Untitled document'}</p>
                {errors[`documents.${i}.url`] && <p role="alert" className="text-[13px] text-danger-text">{errors[`documents.${i}.url`]}</p>}
              </div>
              <Button variant="secondary" size="sm" icon={ExternalLink} as="a" href={assetUrl(d.url)} target="_blank" rel="noreferrer" aria-label={`Open ${d.name || 'document'}`}>Open</Button>
              <IconButton label={`Remove ${d.name || 'document'}`} icon={Trash2} className="hover:text-danger" onClick={() => set('documents', draft.documents.filter((x) => x._k !== d._k))} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ProfileEditor({ profile }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(() => toDraft(profile));
  const [errors, setErrors] = useState({});
  const [tab, setTab] = useState('company');

  const baseline = useMemo(() => JSON.stringify(payloadOf(toDraft(profile), profile)), [profile]);
  const dirty = JSON.stringify(payloadOf(draft, profile)) !== baseline;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (name, value) => {
    setDraft((d) => ({ ...d, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  };
  const setContact = (name, value) => {
    setDraft((d) => ({ ...d, contact: { ...d.contact, [name]: value } }));
    setErrors((e) => (e[`contact.${name}`] ? { ...e, [`contact.${name}`]: undefined } : e));
  };

  const save = useMutation({
    mutationFn: () => put('/exhibitors/profile/me', payloadOf(draft, profile)),
    onSuccess: (res) => {
      qc.setQueryData(KEYS.profile, res.data.profile);
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
      setErrors({});
      toast.success('Profile saved');
    },
    onError: (err) => {
      const fields = fieldErrors(err);
      setErrors(fields);
      const first = Object.keys(fields)[0];
      if (first) setTab(tabOf(first));
      toast.error(first ? 'Please fix the highlighted fields' : errorMessage(err));
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (!draft.companyName.trim()) {
      setTab('company');
      setErrors({ companyName: 'Company name is required' });
      return;
    }
    save.mutate();
  };

  return (
    <form onSubmit={submit} noValidate>
      <Tabs tabs={TABS(draft)} value={tab} onChange={setTab} label="Profile sections" className="mb-6" />
      <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'company' && <CompanyTab draft={draft} set={set} setContact={setContact} errors={errors} />}
        {tab === 'products' && <ProductsTab draft={draft} set={set} errors={errors} />}
        {tab === 'documents' && <DocumentsTab draft={draft} set={set} errors={errors} />}
      </div>

      <div className="sticky bottom-4 z-10 mt-8">
        <div className="card flex flex-wrap items-center justify-between gap-3 p-3 pl-5 shadow-xl">
          <p className="text-sm font-medium" role="status">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
          <div className="flex gap-2">
            <Button variant="ghost" icon={Undo2} disabled={!dirty || save.isPending} onClick={() => { setDraft(toDraft(profile)); setErrors({}); }}>Discard</Button>
            <Button type="submit" icon={Save} loading={save.isPending} disabled={!dirty}>Save changes</Button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default function Profile() {
  const { data: profile, isLoading, error, refetch } = useMyProfile();
  const ref = usePageReveal(!isLoading);

  return (
    <div ref={ref}>
      <PageHeader title="Company profile" subtitle="This is what organizers and visitors see when they discover you." />
      {isLoading && <PageLoader />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!isLoading && !error && (
        <>
          {!profile && (
            <div className="mb-6" data-reveal>
              <Alert tone="info" title="Create your company profile">Add your company name and details to unlock expo applications.</Alert>
            </div>
          )}
          <ProfileEditor profile={profile} />
        </>
      )}
    </div>
  );
}
