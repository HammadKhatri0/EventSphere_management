import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext.jsx';
import { errorMessage, fieldErrors } from '../../lib/api.js';
import { ROLE_HOME } from '../../lib/utils.js';
import { useForm } from '../../hooks/index.js';
import { Alert, Button, Input } from '../../components/ui/index.jsx';
import AuthShell from './AuthShell.jsx';
import RoleSelector from './RoleSelector.jsx';

const DEMO = {
  admin: ['admin@eventsphere.com', 'Admin@123'],
  exhibitor: ['exhibitor@eventsphere.com', 'Exhibitor@123'],
  attendee: ['attendee@eventsphere.com', 'Attendee@123'],
};

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(location.state?.role || 'attendee');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const { bind, values, set, errors, setErrors } = useForm({ email: '', password: '' });

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const next = {};
    if (!values.email) next.email = 'Enter your email';
    if (!values.password) next.password = 'Enter your password';
    if (Object.keys(next).length) return setErrors(next);
    setBusy(true);
    try {
      const user = await login({ email: values.email.trim(), password: values.password, role });
      const from = location.state?.from;
      nav(from && from.startsWith(ROLE_HOME[user.role]) ? from : ROLE_HOME[user.role], { replace: true });
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your EventSphere portal." footer={<>New to EventSphere? <Link to="/register" className="font-semibold text-primary-text hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <RoleSelector value={role} onChange={setRole} />
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Input label="Email" type="email" autoComplete="email" icon={Mail} placeholder="you@company.com" required {...bind('email')} />
        <div>
          <div className="relative">
            <Input label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" icon={Lock} placeholder="Your password" required className="pr-11" {...bind('password')} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
              className="absolute right-2 top-[34px] size-8 grid place-items-center rounded-lg text-muted hover:text-fg hover:bg-surface-2">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          </div>
          <div className="text-right mt-1.5"><Link to="/forgot-password" className="text-sm font-semibold text-primary-text hover:underline">Forgot password?</Link></div>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in as {{ admin: 'Organizer', exhibitor: 'Exhibitor', attendee: 'Attendee' }[role]}</Button>
        {import.meta.env.DEV && (
          <button type="button" onClick={() => { set('email', DEMO[role][0]); set('password', DEMO[role][1]); }} className="w-full text-center text-xs text-muted hover:text-fg underline underline-offset-2">Fill demo credentials (development only)</button>
        )}
      </form>
    </AuthShell>
  );
}
