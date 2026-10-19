import { useEffect, useState } from 'react';
import { api } from '../api';

type Summary = {
  requestsCreated: number;
  submittedToProvider: number;
  delivered: number;
  read: number;
  replies: number;
  ratings: number;
  ratingDistribution: Record<string, number>;
  landingVisits: number;
  draftCopies: number;
  googleClicks: number;
  privateFeedback: number;
  failures: number;
  conversions: Record<string, number | null>;
  note: string;
  empty: boolean;
};

export function AnalyticsPage() {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    void api<Summary>('/api/v1/analytics').then(setData);
  }, []);

  if (!data) return <div className="panel">Loading analytics…</div>;

  const cells: [string, number][] = [
    ['Requests created', data.requestsCreated],
    ['Submitted to provider', data.submittedToProvider],
    ['Delivered', data.delivered],
    ['Read', data.read],
    ['Replies', data.replies],
    ['Ratings', data.ratings],
    ['Landing visits', data.landingVisits],
    ['Draft copies', data.draftCopies],
    ['Google clicks', data.googleClicks],
    ['Private feedback', data.privateFeedback],
    ['Failures', data.failures],
  ];

  return (
    <div className="space-y-6 animate-rise">
      <section className="panel">
        <h1 className="font-display text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-ink-800/70">
          All metrics are from persisted events. {data.note}
        </p>
        {data.empty && (
          <p className="mt-3 text-sm" data-testid="analytics-empty">
            No events yet — send a review request to populate.
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="analytics-grid">
          {cells.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-ink-800/10 bg-sand-50/80 p-4">
              <p className="text-xs uppercase tracking-wide text-ink-800/50">{label}</p>
              <p className="mt-1 font-display text-3xl font-bold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <h2 className="font-semibold">Rating distribution</h2>
          <div className="mt-2 flex gap-3 text-sm" data-testid="rating-distribution">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n}>
                {n}★: {data.ratingDistribution[n] || 0}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <h2 className="font-semibold">Conversion rates</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-800/80">
            {Object.entries(data.conversions).map(([k, v]) => (
              <li key={k}>
                {k}: {v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
