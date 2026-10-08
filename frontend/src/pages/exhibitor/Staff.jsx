import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Pencil, Phone, Trash2, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Alert, Avatar, Button, Card, ConfirmModal, EmptyState, ErrorState, IconButton, Input, Modal, PageHeader, PageLoader,
} from '../../components/ui/index.jsx';
import { useForm } from '../../hooks/index.js';
import { errorMessage, fieldErrors, put } from '../../lib/api.js';
import { KEYS, stripFieldPrefix, toProfilePayload, useMyProfile, usePageReveal } from './shared.js';

const MAX_STAFF = 30;
const BLANK = { name: '', role: '', email: '', phone: '' };

function StaffModal({ member, onClose, onSave, saving, serverErrors }) {
  const form = useForm(member ? { name: member.name, role: member.role || '', email: member.email || '', phone: member.phone || '' } : BLANK);
  const { setErrors } = form;
  useEffect(() => { setErrors(serverErrors); }, [serverErrors, setErrors]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.values.name.trim()) return form.setErrors({ name: 'Name is required' });
    onSave(form.values);
  };

  return (
    <Modal open onClose={onClose} title={member ? 'Edit staff member' : 'Add staff member'} description="Team members organizers and partners can contact."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="staff-form" loading={saving}>{member ? 'Save changes' : 'Add member'}</Button></>}>
      <form id="staff-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" required maxLength={80} data-autofocus {...form.bind('name')} wrapperClassName="sm:col-span-2" />
        <Input label="Role" maxLength={80} placeholder="e.g. Sales Director" {...form.bind('role')} wrapperClassName="sm:col-span-2" />
        <Input label="Email" type="email" {...form.bind('email')} />
        <Input label="Phone" type="tel" maxLength={30} {...form.bind('phone')} />
      </form>
    </Modal>
  );
}

function StaffCard({ member, onEdit, onRemove }) {
  return (
    <Card data-reveal className="p-5">
      <div className="flex items-start gap-3">
        <Avatar name={member.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold truncate">{member.name}</h3>
          <p className="text-sm text-muted truncate">{member.role || 'No role set'}</p>
        </div>
        <div className="flex -mr-2 -mt-2">
          <IconButton label={`Edit ${member.name}`} icon={Pencil} onClick={onEdit} />
          <IconButton label={`Remove ${member.name}`} icon={Trash2} className="hover:text-danger" onClick={onRemove} />
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex items-center gap-2 min-w-0"><Mail className="size-4 text-muted shrink-0" aria-hidden />
          {member.email ? <a href={`mailto:${member.email}`} className="truncate hover:underline text-primary-text">{member.email}</a> : <span className="text-muted">No email</span>}
        </li>
        <li className="flex items-center gap-2"><Phone className="size-4 text-muted shrink-0" aria-hidden />
          {member.phone ? <a href={`tel:${member.phone}`} className="hover:underline text-primary-text">{member.phone}</a> : <span className="text-muted">No phone</span>}
        </li>
      </ul>
    </Card>
  );
}

export default function Staff() {
  const qc = useQueryClient();
  const { data: profile, isLoading, error, refetch } = useMyProfile();
  const ref = usePageReveal(!isLoading);
  const [editing, setEditing] = useState(null); // null | 'new' | staff member
  const [removing, setRemoving] = useState(null);
  const [serverErrors, setServerErrors] = useState({});

  const staff = profile?.staff || [];
  const close = () => { setEditing(null); setServerErrors({}); };

  /** Every change re-sends the whole profile with the new staff list. */
  const saveStaff = useMutation({
    mutationFn: (nextStaff) => put('/exhibitors/profile/me', toProfilePayload({ ...profile, staff: nextStaff })),
    onSuccess: (res) => {
      qc.setQueryData(KEYS.profile, res.data.profile);
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
    onError: (err) => {
      const fields = stripFieldPrefix(fieldErrors(err), 'staff');
      setServerErrors(fields);
      if (!Object.keys(fields).length) toast.error(errorMessage(err));
    },
  });

  const change = (next, message) => saveStaff.mutate(next, {
    onSuccess: () => { toast.success(message); close(); setRemoving(null); },
  });

  const upsert = (values) => (editing === 'new'
    ? change([...staff, values], 'Staff member added')
    : change(staff.map((s) => (s._id === editing._id ? { ...s, ...values } : s)), 'Staff member updated'));

  return (
    <div ref={ref}>
      <PageHeader title="Staff" subtitle="The people representing your company at expos."
        actions={profile && <Button icon={UserPlus} disabled={staff.length >= MAX_STAFF} onClick={() => setEditing('new')}>Add staff member</Button>} />

      {isLoading && <PageLoader />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!isLoading && !error && !profile && (
        <Alert tone="warning" title="Create your company profile first">
          Staff are stored on your company profile. <Link to="/exhibitor/profile" className="font-semibold underline">Set up your profile</Link> to add team members.
        </Alert>
      )}
      {profile && staff.length === 0 && (
        <Card data-reveal><EmptyState icon={Users} title="No staff added yet" text="Add the team members who will staff your booth so organizers know who to contact."
          action={<Button icon={UserPlus} onClick={() => setEditing('new')}>Add staff member</Button>} /></Card>
      )}
      {staff.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((m) => <li key={m._id}><StaffCard member={m} onEdit={() => setEditing(m)} onRemove={() => setRemoving(m)} /></li>)}
        </ul>
      )}

      {editing && <StaffModal key={editing._id || 'new'} member={editing === 'new' ? null : editing} onClose={close} onSave={upsert} saving={saveStaff.isPending} serverErrors={serverErrors} />}

      <ConfirmModal open={!!removing} onClose={() => setRemoving(null)} title="Remove staff member?" confirmText="Remove" loading={saveStaff.isPending}
        message={`${removing?.name} will be removed from your company profile.`}
        onConfirm={() => change(staff.filter((s) => s._id !== removing._id), 'Staff member removed')} />
    </div>
  );
}
