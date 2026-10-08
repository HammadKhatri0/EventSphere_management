import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Check, KeyRound, Lock, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext.jsx';
import { errorMessage, fieldErrors } from '../../lib/api.js';
import { cn, ROLE_HOME } from '../../lib/utils.js';
import { useForm } from '../../hooks/index.js';
import { Alert, Button, Checkbox, Input } from '../../components/ui/index.jsx';
import AuthShell from './AuthShell.jsx';
import RoleSelector from './RoleSelector.jsx';

const RULES = [
  ['At least 8 characters', (p) => p.length >= 8],
  ['One uppercase letter', (p) => /[A-Z]/.test(p)],
  ['One lowercase letter', (p) => /[a-z]/.test(p)],
  ['One number', (p) => /\d/.test(p)],
];

export function PasswordRules({ password }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2" aria-label="Password requirements">
      {RULES.map(([label, test]) => {
        const ok = test(password);
        return <li key={label} className={cn('flex items-center gap-1.5 text-xs', ok ? 'text-success-text' : 'text-muted')}><Check className={cn('size-3.5', !ok && 'opacity-30')} aria-hidden />{label}<span className="sr-only">{ok ? ' (met)' : ' (not met)'}</span></li>;
      })}
    </ul>
  );
}

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [role, setRole] = useState('attendee');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const { bind, values, set, errors, setErrors } = useForm({ name: '', email: '', company: '', phone: '', organizerCode: '', password: '', confirm: '', consent: false, marketingConsent: false });
  const valid = useMemo(() => RULES.every(([, t]) => t(values.password)), [values.password]);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const next = {};
    if (!values.name.trim()) next.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = 'Enter a valid email address';
    if (role === 'exhibitor' && !values.company.trim()) next.company = 'Company name is required for exhibitors';
    if (role === 'admin' && !values.organizerCode.trim()) next.organizerCode = 'Enter the organizer access code you were given';
    if (!valid) next.password = 'Password does not meet the requirements';
    if (values.password !== values.confirm) next.confirm = 'Passwords do not match';
    if (!values.consent) next.consent = 'You must accept the terms and privacy policy';
    if (Object.keys(next).length) return setErrors(next);

    setBusy(true);
    try {
      const user = await register({
        name: values.name.trim(), email: values.email.trim(), password: values.password, role,
        company: values.company.trim() || undefined, phone: values.phone.trim() || undefined,
        organizerCode: role === 'admin' ? values.organizerCode.trim() : undefined,
        consent: true, marketingConsent: values.marketingConsent,
      });
      toast.success('Account created — welcome to EventSphere!');
      nav(ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Create your account" subtitle="Choose how you’ll use EventSphere — you’ll be taken straight to your portal." footer={<>Already registered? <Link to="/login" className="font-semibold text-primary-text hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <RoleSelector value={role} onChange={setRole} legend="I am registering as" />
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Input label="Full name" autoComplete="name" icon={User} required {...bind('name')} />
        <Input label="Email" type="email" autoComplete="email" icon={Mail} required {...bind('email')} />
        {role === 'exhibitor' && <Input label="Company name" autoComplete="organization" icon={Briefcase} required {...bind('company')} />}
        {role === 'admin' && <Input label="Organizer access code" icon={KeyRound} required hint="Organizer accounts require an invitation code from EventSphere." {...bind('organizerCode')} />}
        <Input label="Phone (optional)" type="tel" autoComplete="tel" icon={Phone} {...bind('phone')} />
        <div>
          <Input label="Password" type="password" autoComplete="new-password" icon={Lock} required {...bind('password')} />
          <PasswordRules password={values.password} />
        </div>
        <Input label="Confirm password" type="password" autoComplete="new-password" icon={Lock} required {...bind('confirm')} />
        <Checkbox checked={values.consent} onChange={(e) => set('consent', e.target.checked)} error={errors.consent}
          label={<>I agree to the <span className="font-semibold">Terms of Service</span> and consent to my data being processed as described in the <span className="font-semibold">Privacy Policy</span>.</>} />
        <Checkbox checked={values.marketingConsent} onChange={(e) => set('marketingConsent', e.target.checked)} label="Send me occasional product and event updates (optional)." />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
      </form>
    </AuthShell>
  );
}
