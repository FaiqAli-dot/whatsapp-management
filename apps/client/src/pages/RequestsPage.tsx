import { useEffect, useState } from 'react';
import { api } from '../api';

type Customer = { id: string; name: string; phoneE164: string };
type RequestRow = {
  id: string;
  customerId: string;
  status: string;
  simulated: boolean;
  rating?: number | null;
  failureReason?: string | null;
  draftText?: string | null;
};

export function RequestsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState('');
  const [preview, setPreview] = useState<{
    canSend: boolean;
    issues: string[];
    simulated: boolean;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  async function refresh() {
    const [c, r] = await Promise.all([
      api<{ items: Customer[] }>('/api/v1/customers?limit=100'),
      api<{ items: RequestRow[] }>('/api/v1/review-requests?limit=50'),
    ]);
    setCustomers(c.items);
    setRequests(r.items);
  }

  useEffect(() => {
    void refresh().catch((e) => setError(String(e.message || e)));
  }, []);

  async function doPreview() {
    setError('');
    const data = await api<{ canSend: boolean; issues: string[]; simulated: boolean }>(
      '/api/v1/review-requests/preview',
      { method: 'POST', json: { customerId: selected } },
    );
    setPreview(data);
  }

  async function confirmSend() {
    setError('');
    setMessage('');
    const data = await api<{ request: RequestRow }>('/api/v1/review-requests', {
      method: 'POST',
      json: { customerId: selected, confirm: true },
    });
    setActiveId(data.request.id);
    setMessage(`Request ${data.request.status}${data.request.simulated ? ' (SIMULATED)' : ''}`);
    await refresh();
  }

  async function simulateDeliver(status: 'delivered' | 'failed') {
    if (!activeId) return;
    await api('/api/v1/simulator/deliver', {
      method: 'POST',
      json: { reviewRequestId: activeId, status },
    });
    setMessage(`Simulated ${status}`);
    await refresh();
  }

  async function simulateReply(text: string) {
    if (!activeId) return;
    const data = await api<{ request: RequestRow }>('/api/v1/simulator/inbound', {
      method: 'POST',
      json: { reviewRequestId: activeId, text },
    });
    setMessage(`Reply processed. Rating: ${data.request.rating ?? 'n/a'}`);
    await refresh();
  }

  return (
    <div className="space-y-6 animate-rise">
      <section className="panel">
        <h1 className="font-display text-2xl font-bold">Review requests</h1>
        <p className="mt-1 text-sm text-ink-800/70">
          Preview validates consent, connection, limits, and duplicates before send.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            className="input max-w-sm"
            data-testid="request-customer"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phoneE164})
              </option>
            ))}
          </select>
          <button
            className="btn-secondary"
            data-testid="request-preview"
            disabled={!selected}
            onClick={() => void doPreview().catch((e) => setError(e.message))}
          >
            Preview
          </button>
          <button
            className="btn-primary"
            data-testid="request-confirm"
            disabled={!preview?.canSend}
            onClick={() => void confirmSend().catch((e) => setError(e.message))}
          >
            Confirm & send
          </button>
        </div>
        {preview && (
          <div className="mt-3 text-sm" data-testid="request-preview-result">
            {preview.simulated && <span className="sim-badge mr-2">SIMULATED</span>}
            {preview.canSend ? 'Ready to send' : preview.issues.join(' · ')}
          </div>
        )}
        {message && (
          <p className="mt-3 text-sm text-moss-500" data-testid="request-message">
            {message}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-coral-600">{error}</p>}

        {activeId && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-800/10 pt-4">
            <span className="sim-badge">Simulator controls</span>
            <button
              className="btn-secondary"
              data-testid="sim-deliver"
              onClick={() => void simulateDeliver('delivered')}
            >
              Simulate delivery
            </button>
            <button
              className="btn-secondary"
              data-testid="sim-fail"
              onClick={() => void simulateDeliver('failed')}
            >
              Simulate failure
            </button>
            <button
              className="btn-secondary"
              data-testid="sim-rate-5"
              onClick={() => void simulateReply('5 - Great service!')}
            >
              Reply 5
            </button>
            <button
              className="btn-secondary"
              data-testid="sim-rate-3"
              onClick={() => void simulateReply('3')}
            >
              Reply 3
            </button>
            <button
              className="btn-secondary"
              data-testid="sim-rate-1"
              onClick={() => void simulateReply('1 - Not happy')}
            >
              Reply 1
            </button>
            <button
              className="btn-secondary"
              data-testid="sim-optout"
              onClick={() => void simulateReply('STOP')}
            >
              Reply STOP
            </button>
          </div>
        )}
      </section>

      <section className="panel overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="requests-table">
          <thead>
            <tr className="border-b border-ink-800/10 text-ink-800/60">
              <th className="py-2">Status</th>
              <th className="py-2">Rating</th>
              <th className="py-2">Simulated</th>
              <th className="py-2">Failure</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr
                key={r.id}
                className="border-b border-ink-800/5"
                data-testid={`request-row-${r.id}`}
              >
                <td className="py-2">
                  <button className="font-medium underline" onClick={() => setActiveId(r.id)}>
                    {r.status}
                  </button>
                </td>
                <td className="py-2">{r.rating ?? '—'}</td>
                <td className="py-2">{r.simulated ? 'yes' : 'no'}</td>
                <td className="py-2 text-coral-600">{r.failureReason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
