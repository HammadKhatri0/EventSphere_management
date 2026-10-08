import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, ExternalLink, FileText, Globe, Mail, MapPin, MessageSquare, Phone, Send, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, Avatar, Badge, Button, Card, Chips, ErrorState, Input, Select, Skeleton, Textarea } from '../../components/ui/index.jsx';
import FloorPlan from '../../components/FloorPlan.jsx';
import { assetUrl, errorMessage, fieldErrors, get, post } from '../../lib/api.js';
import { fmtDate, toLocalInput } from '../../lib/utils.js';
import { useForm, useLiveBooths } from '../../hooks/index.js';
import { locateUrl } from './ExhibitorCard.jsx';
import { useBoothVisit } from './attendeeShared.js';

const TYPES = [{ value: 'inquiry', label: 'Inquiry' }, { value: 'appointment', label: 'Book appointment' }];
const EMPTY_FORM = { type: 'inquiry', subject: '', message: '', appointmentAt: '' };

function InquiryForm({ profile, expoId }) {
  const qc = useQueryClient();
  const form = useForm(EMPTY_FORM);
  const [sent, setSent] = useState(false);
  const { values, errors, setErrors, set, bind } = form;
  const isAppointment = values.type === 'appointment';

  const send = useMutation({
    mutationFn: (body) => post('/inquiries', body),
    onSuccess: () => {
      setSent(true);
      form.reset();
      qc.invalidateQueries({ queryKey: ['inquiries'] });
      toast.success(isAppointment ? 'Appointment request sent' : 'Inquiry sent');
    },
    onError: (err) => {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!values.subject.trim()) next.subject = 'Add a short subject';
    if (!values.message.trim()) next.message = 'Write a message for the exhibitor';
    if (isAppointment && !(values.appointmentAt && new Date(values.appointmentAt) > new Date())) next.appointmentAt = 'Choose a future date and time';
    if (Object.keys(next).length) { setErrors(next); return; }
    send.mutate({
      expoId, exhibitorId: profile.userId, type: values.type, subject: values.subject.trim(), message: values.message.trim(),
      appointmentAt: isAppointment ? new Date(values.appointmentAt).toISOString() : undefined,
    });
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Message sent">The exhibitor will reply in your inquiries inbox and you will get a notification.</Alert>
        <div className="flex flex-wrap gap-2">
          <Button to="/attendee/inquiries" icon={MessageSquare}>View my inquiries</Button>
          <Button variant="secondary" onClick={() => setSent(false)}>Send another</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Chips label="Request type" options={TYPES} value={values.type} onChange={(v) => set('type', v)} />
      <Input label="Subject" required maxLength={140} placeholder={isAppointment ? 'Product demo for our team' : 'Question about your products'} {...bind('subject')} />
      {isAppointment && (
        <Input label="Preferred date and time" type="datetime-local" required min={toLocalInput(new Date(Date.now() + 60_000))} hint="The exhibitor can accept or propose another slot." {...bind('appointmentAt')} />
      )}
      <Textarea label="Message" required rows={4} maxLength={2000} placeholder="Tell them what you would like to know." {...bind('message')} />
      <Button type="submit" loading={send.isPending} icon={isAppointment ? CalendarClock : Send} className="w-full">{isAppointment ? 'Request appointment' : 'Send inquiry'}</Button>
    </form>
  );
}

function ProductGrid({ products }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {products.map((p) => (
        <li key={p.name} className="flex gap-3 rounded-xl border border-line p-3">
          <Avatar name={p.name} src={p.image} square size="lg" />
          <div className="min-w-0"><p className="font-semibold leading-snug">{p.name}</p>{p.description && <p className="text-sm text-muted line-clamp-3">{p.description}</p>}</div>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, icon: Icon, children, id }) {
  return (
    <Card data-reveal className="p-5 sm:p-6 space-y-4" id={id} as="section" aria-label={title}>
      <h2 className="text-lg font-bold flex items-center gap-2">{Icon && <Icon className="size-5 text-primary-text" aria-hidden />}{title}</h2>
      {children}
    </Card>
  );
}

export default function ExhibitorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const query = useQuery({ queryKey: ['exhibitor', id], queryFn: () => get(`/exhibitors/${id}`) });
  const { profile, booths = [] } = query.data || {};

  const [chosenExpo, setChosenExpo] = useState('');
  const expoOptions = [...new Map(booths.map((b) => [b.expo._id, b.expo])).values()];
  const expoId = chosenExpo || expoOptions.find((e) => new Date(e.startDate) >= new Date())?._id || expoOptions[0]?._id;
  const expoBooths = booths.filter((b) => b.expo._id === expoId);
  const primary = expoBooths[0];
  const plan = useLiveBooths(expoId);
  useBoothVisit(expoId, primary?._id);

  useEffect(() => {
    if (query.data && hash === '#inquiry') document.getElementById('inquiry')?.scrollIntoView({ block: 'start' });
  }, [query.data, hash]);

  if (query.isLoading) return <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]"><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-80" /><Skeleton className="h-80" /></div>;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;

  return (
    <>
      <Link to="/attendee/exhibitors" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg mb-4"><ArrowLeft className="size-4" aria-hidden />All exhibitors</Link>

      <section data-reveal aria-labelledby="company-name" className="card p-5 sm:p-8 mb-6 flex flex-col sm:flex-row gap-5 sm:gap-7">
        <Avatar name={profile.companyName} src={profile.logo} size="xl" square />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 id="company-name" className="text-2xl sm:text-4xl font-extrabold">{profile.companyName}</h1>
            {profile.tagline && <p className="text-lg text-muted mt-1">{profile.tagline}</p>}
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label="Categories">{(profile.categories || []).map((c) => <li key={c}><Badge tone="primary">{c}</Badge></li>)}</ul>
          <div className="flex flex-wrap gap-2 pt-1">
            {profile.website && <Button as="a" href={profile.website} target="_blank" rel="noopener noreferrer" variant="secondary" icon={Globe}>Visit website<ExternalLink className="size-3.5" aria-hidden /></Button>}
            {primary && <Button to={locateUrl(expoId, primary._id)} variant="secondary" icon={MapPin}>Locate on floor plan</Button>}
            <Button as="a" href="#inquiry" icon={MessageSquare}>Contact</Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] items-start">
        <div className="space-y-6 min-w-0">
          <Section title="About">
            <p className="whitespace-pre-line text-muted leading-relaxed">{profile.description || 'This exhibitor has not added a description yet.'}</p>
            {(profile.contact?.email || profile.contact?.phone) && (
              <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {profile.contact.email && <li className="flex items-center gap-1.5"><Mail className="size-4 text-muted" aria-hidden /><a className="hover:underline" href={`mailto:${profile.contact.email}`}>{profile.contact.email}</a></li>}
                {profile.contact.phone && <li className="flex items-center gap-1.5"><Phone className="size-4 text-muted" aria-hidden />{profile.contact.phone}</li>}
              </ul>
            )}
          </Section>

          {profile.products?.length > 0 && <Section title="Products and services"><ProductGrid products={profile.products} /></Section>}

          {profile.documents?.length > 0 && (
            <Section title="Documents" icon={FileText}>
              <ul className="divide-y divide-line">
                {profile.documents.map((d) => (
                  <li key={d.url}>
                    <a href={assetUrl(d.url)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 py-2.5 font-medium hover:text-primary-text">
                      <span className="truncate">{d.name || 'Document'}</span><ExternalLink className="size-4 shrink-0 text-muted" aria-label="opens in a new tab" />
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Find them on the floor" icon={MapPin}>
            {expoOptions.length > 1 && <Select label="Expo" value={expoId} onChange={(e) => setChosenExpo(e.target.value)} options={expoOptions.map((e) => ({ value: e._id, label: e.title }))} />}
            {plan.isLoading ? <Skeleton className="h-64" /> : plan.data && (
              <FloorPlan mode="view" floorPlan={plan.data.floorPlan} booths={plan.data.booths} highlightId={primary?._id} showPrice={false}
                onSelect={(b) => navigate(`/attendee/floor-plan?expo=${expoId}&booth=${b._id}`)} />
            )}
          </Section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 min-w-0">
          <Section title="Contact this exhibitor" icon={MessageSquare} id="inquiry"><InquiryForm key={expoId} profile={profile} expoId={expoId} /></Section>

          <Section title="Booth locations" icon={MapPin}>
            <ul className="space-y-3">
              {booths.map((b) => (
                <li key={b._id} className="rounded-xl border border-line p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">Booth {b.code}{b.zone && <span className="font-medium text-muted"> · {b.zone}</span>}</p>
                    <p className="text-sm text-muted truncate">{b.expo.title} · {fmtDate(b.expo.startDate)}</p>
                  </div>
                  <Link to={locateUrl(b.expo._id, b._id)} className="text-[13px] font-semibold text-primary-text hover:underline shrink-0">Locate</Link>
                </li>
              ))}
            </ul>
          </Section>

          {profile.staff?.length > 0 && (
            <Section title="Team on site" icon={Users}>
              <ul className="space-y-3">
                {profile.staff.map((s) => (
                  <li key={`${s.name}-${s.role}`} className="flex items-center gap-3"><Avatar name={s.name} /><div><p className="font-semibold leading-tight">{s.name}</p>{s.role && <p className="text-sm text-muted">{s.role}</p>}</div></li>
                ))}
              </ul>
            </Section>
          )}
        </aside>
      </div>
    </>
  );
}
