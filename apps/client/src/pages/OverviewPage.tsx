import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

type Biz = {
  business: { name: string; onboardingComplete: boolean; planId: string };
  whatsapp: { status: string; mode: string; simulated: boolean; lastError?: string } | null;
  setupHints: string[];
};

export function OverviewPage() {
  const [data, setData] = useState<Biz | null>(null);

  useEffect(() => {
    void api<Biz>('/api/v1/business/me')
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div className="space-y-6 animate-rise">
      <section className="panel">
        <h1 className="font-display text-3xl font-bold">
          {data?.business.name || 'Your business'}
        </h1>
        <p className="mt-2 max-w-2xl text-ink-800/70">
          Send review requests from your own WhatsApp Business account. Customers reply with a
          rating; we help them copy a draft and open Google Reviews themselves.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-primary" to="/customers" data-testid="goto-customers">
            Manage customers
          </Link>
          <Link className="btn-secondary" to="/requests">
            Review requests
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2 className="text-lg font-semibold">Connection health</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span>
            WhatsApp: <strong data-testid="wa-status">{data?.whatsapp?.status || 'unknown'}</strong>
          </span>
          {data?.whatsapp?.simulated && (
            <span className="sim-badge" data-testid="sim-badge">
              SIMULATED
            </span>
          )}
          <span>Plan: {data?.business.planId}</span>
        </div>
        {data?.whatsapp?.lastError && (
          <p className="mt-2 text-sm text-coral-600">{data.whatsapp.lastError}</p>
        )}
        {data?.setupHints?.length ? (
          <ul
            className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-800/80"
            data-testid="setup-hints"
          >
            {data.setupHints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-moss-500">Onboarding looks complete.</p>
        )}
      </section>
    </div>
  );
}
