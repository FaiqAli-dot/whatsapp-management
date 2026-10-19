import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth, type User } from '../auth';

export function LoginPage() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const data = await api<{ user: User }>('/api/v1/auth/login', {
        method: 'POST',
        json: { email, password },
      });
      setUser(data.user);
      nav(data.user.businessId ? '/' : '/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="animate-rise panel">
        <p className="font-display text-3xl font-bold text-ink-950">ReviewRelay</p>
        <p className="mt-2 text-sm text-ink-800/70">
          Sign in to request Google reviews via your WhatsApp Business account.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              data-testid="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              data-testid="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-coral-600" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" data-testid="login-submit" type="submit">
            Sign in
          </button>
        </form>
        <p className="mt-4 text-sm text-ink-800/70">
          New here?{' '}
          <Link className="font-semibold text-moss-500" to="/register">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
