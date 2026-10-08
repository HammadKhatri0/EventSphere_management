import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Download, Lock, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { api, del, errorMessage, fieldErrors, patch, setAccessToken } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForm } from '../../hooks/index.js';
import { ROLE_LABEL } from '../../lib/utils.js';
import { Alert, Avatar, Badge, Button, Card, CardHeader, ConfirmModal, FileUpload, Input, PageHeader, Toggle } from '../../components/ui/index.jsx';
import { PasswordRules } from '../auth/Register.jsx';

export default function AccountSettings() {
  const { user, updateUser, logout } = useAuth();
  const nav = useNavigate();
  const profile = useForm({ name: user.name || '', phone: user.phone || '', company: user.company || '' });
  const pw = useForm({ currentPassword: '', newPassword: '', confirm: '' });
  const [marketing, setMarketing] = useState(!!user.marketingConsent);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const save = useMutation({
    mutationFn: (body) => patch('/auth/me', body),
    onSuccess: (r) => { updateUser(r.data.user); toast.success('Profile updated'); },
    onError: (e) => { profile.setErrors(fieldErrors(e)); toast.error(errorMessage(e)); },
  });
  const changePw = useMutation({
    mutationFn: (body) => patch('/auth/me/password', body),
    onSuccess: (r) => { setAccessToken(r.data.accessToken); pw.reset(); toast.success('Password changed. Other devices were signed out.'); },
    onError: (e) => { pw.setErrors(fieldErrors(e)); toast.error(errorMessage(e)); },
  });
  const erase = useMutation({
    mutationFn: () => del('/auth/me', { password: deletePw }),
    onSuccess: async () => { toast.success('Your account has been deleted'); await logout(); nav('/', { replace: true }); },
    onError: (e) => setDeleteError(errorMessage(e)),
  });

  const submitProfile = (e) => {
    e.preventDefault();
    save.mutate({ name: profile.values.name.trim(), phone: profile.values.phone.trim(), company: profile.values.company.trim() });
  };
  const submitPw = (e) => {
    e.preventDefault();
    if (pw.values.newPassword !== pw.values.confirm) return pw.setErrors({ confirm: 'Passwords do not match' });
    changePw.mutate({ currentPassword: pw.values.currentPassword, newPassword: pw.values.newPassword });
  };
  const exportData = async () => {
    try {
      const res = await api.get('/auth/me/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = Object.assign(document.createElement('a'), { href: url, download: 'eventsphere-my-data.json' });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <>
      <PageHeader title="Account & privacy" subtitle="Manage your profile, password and personal data." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card id="profile" data-reveal>
          <CardHeader title="Profile" subtitle="How you appear across EventSphere." actions={<Badge tone="primary">{ROLE_LABEL[user.role]}</Badge>} />
          <form onSubmit={submitProfile} className="p-5 space-y-4" noValidate>
            <div className="flex items-center gap-4">
              <Avatar name={user.name} src={user.avatar} size="xl" />
              <FileUpload kind="image" value={user.avatar} onChange={(url) => save.mutate({ avatar: url })} buttonText="Change photo" hint="PNG, JPG or WebP up to 5 MB" />
            </div>
            <Input label="Full name" required {...profile.bind('name')} />
            <Input label="Email" value={user.email} disabled hint="Contact support to change your email address." readOnly />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Phone" type="tel" {...profile.bind('phone')} />
              <Input label="Company" {...profile.bind('company')} />
            </div>
            <Button type="submit" icon={UserCog} loading={save.isPending}>Save profile</Button>
          </form>
        </Card>

        <Card data-reveal>
          <CardHeader title="Change password" subtitle="You’ll stay signed in here; other devices are signed out." />
          <form onSubmit={submitPw} className="p-5 space-y-4" noValidate>
            <Input label="Current password" type="password" autoComplete="current-password" required {...pw.bind('currentPassword')} />
            <div>
              <Input label="New password" type="password" autoComplete="new-password" required {...pw.bind('newPassword')} />
              <PasswordRules password={pw.values.newPassword} />
            </div>
            <Input label="Confirm new password" type="password" autoComplete="new-password" required {...pw.bind('confirm')} />
            <Button type="submit" icon={Lock} loading={changePw.isPending}>Update password</Button>
          </form>
        </Card>

        <Card data-reveal className="xl:col-span-2">
          <CardHeader title="Privacy & data" subtitle="You are in control of your personal data (GDPR)." />
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div><p className="font-semibold">Product & event updates</p><p className="text-sm text-muted">Optional emails about new expos and features.</p></div>
              <Toggle checked={marketing} label="Receive product and event updates" onChange={(v) => { setMarketing(v); save.mutate({ marketingConsent: v }); }} />
            </div>
            <hr className="border-line" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className="font-semibold">Download my data</p><p className="text-sm text-muted">A JSON file with everything we store about you.</p></div>
              <Button variant="secondary" icon={Download} onClick={exportData}>Export data</Button>
            </div>
            <hr className="border-line" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className="font-semibold text-danger-text">Delete my account</p><p className="text-sm text-muted">Permanently removes your account and personal data. Booths you hold are released. This cannot be undone.</p></div>
              <Button variant="danger" icon={Trash2} onClick={() => { setDeletePw(''); setDeleteError(''); setConfirmDelete(true); }}>Delete account</Button>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmModal open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => erase.mutate()} loading={erase.isPending} confirmText="Delete permanently"
        title="Delete your account?" message="Enter your password to confirm. All of your data will be erased.">
        <div className="mt-4 space-y-3">
          {deleteError && <Alert tone="danger">{deleteError}</Alert>}
          <Input label="Password" type="password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
        </div>
      </ConfirmModal>
    </>
  );
}
