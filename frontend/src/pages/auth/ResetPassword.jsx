import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, fieldErrors } from '../../lib/api.js';
import { Alert, Button, Input } from '../../components/ui/index.jsx';
import AuthShell from './AuthShell.jsx';
import { PasswordRules } from './Register.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (password !== confirm) return setErrors({ confirm: 'Passwords do not match' });
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Password updated. Please sign in.');
      nav('/login', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something strong that you don’t use elsewhere." footer={<Link to="/login" className="font-semibold text-primary-text hover:underline">Back to sign in</Link>}>
      {!token ? <Alert tone="danger">This reset link is incomplete. Please request a new one from the <Link className="underline font-semibold" to="/forgot-password">forgot password</Link> page.</Alert> : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <div>
            <Input label="New password" type="password" autoComplete="new-password" icon={Lock} required value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
            <PasswordRules password={password} />
          </div>
          <Input label="Confirm new password" type="password" autoComplete="new-password" icon={Lock} required value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
        </form>
      )}
    </AuthShell>
  );
}
