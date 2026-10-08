import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../../lib/api.js';
import { Alert, Button, Input } from '../../components/ui/index.jsx';
import AuthShell from './AuthShell.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [done, setDone] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setFieldError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setFieldError('Enter a valid email address');
    setBusy(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: email.trim() });
      setDone(res.data);
    } catch (err) {
      setFieldError(fieldErrors(err).email || '');
      setError(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we’ll send you a link to choose a new one."
      footer={<Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-primary-text hover:underline"><ArrowLeft className="size-4" aria-hidden />Back to sign in</Link>}>
      {done ? (
        <div className="space-y-4" role="status">
          <div className="size-14 rounded-2xl bg-success-soft text-success-text grid place-items-center"><MailCheck className="size-7" aria-hidden /></div>
          <p className="font-semibold">Check your inbox</p>
          <p className="text-sm text-muted">{done.message}</p>
          {done.devResetUrl && (
            <Alert tone="warning" title="Development mode">
              <p>No email server is configured, so here is your reset link:</p>
              <a href={done.devResetUrl} className="font-semibold underline break-all">{done.devResetUrl}</a>
            </Alert>
          )}
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {error && !fieldError && <Alert tone="danger">{error}</Alert>}
          <Input label="Email" type="email" autoComplete="email" icon={Mail} required value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
