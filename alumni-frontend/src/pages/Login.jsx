import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Button, Input } from '../components/ui';
import AuthSplit, { Field, FormAlert } from '../components/layout/AuthSplit';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(email, password);
      nav('/dashboard');
    } catch (e) {
      setErr(e.response?.data?.error || 'We could not sign you in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplit
      title="Welcome back"
      subtitle="Sign in to reach your batch community."
      footer={<>New to the association? <Link to="/register" className="font-semibold text-[var(--navy)] underline decoration-[var(--gold)] underline-offset-4">Create an account</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormAlert>{err}</FormAlert>
        <Field label="Email address" id="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" id="password">
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" variant="navy" disabled={loading} className="w-full !py-3">{loading ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </AuthSplit>
  );
}
