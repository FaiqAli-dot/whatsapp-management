import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export function OnboardingPage() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: 'salon',
    phone: '',
    country: 'US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    googleReviewUrl: '',
    description: '',
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/v1/business', { method: 'POST', json: form });
      await api('/api/v1/whatsapp/connect/simulator', { method: 'POST', json: {} });
      if (form.googleReviewUrl) {
        await api('/api/v1/business/me/validate-google-url', {
          method: 'POST',
          json: { url: form.googleReviewUrl },
        });
      }
      try {
        await api('/api/v1/business/me/complete-onboarding', { method: 'POST', json: {} });
      } catch {
        // hints may remain — still enter app
      }
      await refresh();
      nav('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onboarding failed');
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="animate-rise panel">
        <p className="font-display text-3xl font-bold">ReviewRelay</p>
        <h1 className="mt-2 text-xl font-semibold">Set up your business</h1>
        <p className="mt-1 text-sm text-ink-800/70">
          Add your profile and Google Review link. WhatsApp starts in simulator mode for safe pilot
          testing.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="label" htmlFor="biz-name">
              Business name
            </label>
            <input
              id="biz-name"
              className="input"
              data-testid="onboard-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="input"
              data-testid="onboard-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="salon">Salon</option>
              <option value="clinic">Clinic</option>
              <option value="restaurant">Restaurant</option>
              <option value="auto_shop">Auto shop</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="phone">
                Phone
              </label>
              <input
                id="phone"
                className="input"
                data-testid="onboard-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1..."
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="country">
                Country
              </label>
              <input
                id="country"
                className="input"
                data-testid="onboard-country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                maxLength={2}
                required
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="tz">
              Timezone
            </label>
            <input
              id="tz"
              className="input"
              data-testid="onboard-timezone"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="gurl">
              Google Review URL
            </label>
            <input
              id="gurl"
              className="input"
              data-testid="onboard-google-url"
              value={form.googleReviewUrl}
              onChange={(e) => setForm({ ...form, googleReviewUrl: e.target.value })}
              placeholder="https://g.page/r/..."
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="desc">
              Description (optional)
            </label>
            <textarea
              id="desc"
              className="input"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {error && (
            <p className="text-sm text-coral-600" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" data-testid="onboard-submit" type="submit">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
