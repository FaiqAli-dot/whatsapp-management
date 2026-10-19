import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

type WaStatus = {
  status: string;
  mode: string;
  simulated: boolean;
  lastError?: string | null;
  embeddedSignup?: { available: boolean; note: string };
};

export function SettingsPage() {
  const nav = useNavigate();
  const { logout } = useAuth();
  const [wa, setWa] = useState<WaStatus | null>(null);
  const [manual, setManual] = useState({
    phoneNumberId: '',
    wabaId: '',
    accessToken: '',
    templateName: 'review_request',
    templateLanguage: 'en_US',
  });
  const [message, setMessage] = useState('');

  async function refresh() {
    const data = await api<WaStatus>('/api/v1/whatsapp/status');
    setWa(data);
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  async function connectSimulator() {
    await api('/api/v1/whatsapp/connect/simulator', { method: 'POST', json: {} });
    setMessage('Connected to simulator');
    await refresh();
  }

  async function disconnect() {
    await api('/api/v1/whatsapp/disconnect', { method: 'POST', json: {} });
    setMessage('WhatsApp disconnected');
    await refresh();
  }

  async function connectManual(e: FormEvent) {
    e.preventDefault();
    await api('/api/v1/whatsapp/connect/manual', { method: 'POST', json: manual });
    setMessage('Manual connection saved (token encrypted at rest)');
    setManual({ ...manual, accessToken: '' });
    await refresh();
  }

  async function deleteAccount() {
    if (!confirm('Delete your account and all business data?')) return;
    await api('/api/v1/account', { method: 'DELETE', json: { confirm: 'DELETE' } });
    await logout();
    nav('/register');
  }

  return (
    <div className="space-y-6 animate-rise">
      <section className="panel">
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-ink-800/70">Manage WhatsApp connection and account.</p>
        <div className="mt-4 text-sm" data-testid="settings-wa">
          Status: <strong>{wa?.status}</strong> · Mode: {wa?.mode}{' '}
          {wa?.simulated && <span className="sim-badge">SIMULATED</span>}
        </div>
        {wa?.lastError && <p className="mt-2 text-sm text-coral-600">{wa.lastError}</p>}
        {wa?.embeddedSignup && (
          <p className="mt-3 text-sm text-ink-800/70" data-testid="embedded-signup-note">
            {wa.embeddedSignup.note}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            data-testid="connect-simulator"
            onClick={() => void connectSimulator()}
          >
            Connect simulator
          </button>
          <button
            className="btn-secondary"
            data-testid="disconnect-wa"
            onClick={() => void disconnect()}
          >
            Disconnect
          </button>
        </div>
        {message && (
          <p className="mt-3 text-sm text-moss-500" data-testid="settings-message">
            {message}
          </p>
        )}
      </section>

      <section className="panel">
        <h2 className="text-lg font-semibold">Manual pilot onboarding (Meta)</h2>
        <p className="mt-1 text-sm text-ink-800/70">
          Use your own Phone Number ID, WABA ID, and access token. Embedded Signup is available only
          when configured.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(e) => void connectManual(e)}>
          <input
            className="input"
            placeholder="Phone Number ID"
            value={manual.phoneNumberId}
            onChange={(e) => setManual({ ...manual, phoneNumberId: e.target.value })}
            required
          />
          <input
            className="input"
            placeholder="WABA ID"
            value={manual.wabaId}
            onChange={(e) => setManual({ ...manual, wabaId: e.target.value })}
            required
          />
          <input
            className="input md:col-span-2"
            placeholder="Access token"
            type="password"
            value={manual.accessToken}
            onChange={(e) => setManual({ ...manual, accessToken: e.target.value })}
            required
          />
          <input
            className="input"
            placeholder="Template name"
            value={manual.templateName}
            onChange={(e) => setManual({ ...manual, templateName: e.target.value })}
          />
          <input
            className="input"
            placeholder="Template language"
            value={manual.templateLanguage}
            onChange={(e) => setManual({ ...manual, templateLanguage: e.target.value })}
          />
          <button className="btn-secondary md:col-span-2" type="submit">
            Save manual connection
          </button>
        </form>
      </section>

      <section className="panel">
        <h2 className="text-lg font-semibold text-coral-600">Delete account</h2>
        <p className="mt-1 text-sm text-ink-800/70">
          Removes credentials, customers, messages, feedback, analytics, and jobs for your tenant.
        </p>
        <button
          className="btn-danger mt-4"
          data-testid="delete-account"
          onClick={() => void deleteAccount()}
        >
          Delete my account
        </button>
      </section>
    </div>
  );
}
