import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth, type User } from '../auth';

export function RegisterPage() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const data = await api<{ user: User }>('/api/v1/auth/register', {
        method: 'POST',
        json: { name, email, password },
      });
      setUser(data.user);
      nav('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="animate-rise panel">
        <p className="font-display text-3xl font-bold">ReviewRelay</p>
        <p className="mt-2 text-sm text-ink-800/70">
          Create your merchant account. You will connect your own WhatsApp Business number.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              className="input"
              data-testid="register-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              data-testid="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              data-testid="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              required
            />
            <p className="mt-1 text-xs text-ink-800/50">
              At least 10 characters with a letter and number.
            </p>
          </div>
          {error && (
            <p className="text-sm text-coral-600" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" data-testid="register-submit" type="submit">
            Create account
          </button>
        </form>
        <p className="mt-4 text-sm">
          Already have an account?{' '}
          <Link className="font-semibold text-moss-500" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
