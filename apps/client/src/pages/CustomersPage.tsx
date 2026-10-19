import { useEffect, useState, type FormEvent } from 'react';
import { api, apiForm } from '../api';

type Customer = {
  id: string;
  name: string;
  phoneE164: string;
  consentStatus: string;
};

export function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [q, setQ] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load(search = q) {
    const data = await api<{ items: Customer[] }>(
      `/api/v1/customers?q=${encodeURIComponent(search)}`,
    );
    setItems(data.items);
  }

  useEffect(() => {
    void load().catch((e) => setError(String(e.message || e)));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/v1/customers', {
        method: 'POST',
        json: { name, phone, consentGiven: true, consentSource: 'manual' },
      });
      setName('');
      setPhone('');
      setMessage('Customer added');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function onImport(file: File) {
    setError('');
    setMessage('');
    const form = new FormData();
    form.append('file', file);
    form.append('mapping', JSON.stringify({ name: 'name', phone: 'phone', consent: 'consent' }));
    try {
      const data = await apiForm<{
        imported: number;
        rejectedCount: number;
        rejectedCsv: string;
        notice: string;
      }>('/api/v1/customers/import', form);
      setMessage(`${data.notice} Imported ${data.imported}, rejected ${data.rejectedCount}.`);
      if (data.rejectedCount > 0) {
        const blob = new Blob([data.rejectedCsv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rejected-rows.csv';
        a.click();
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  }

  return (
    <div className="space-y-6 animate-rise">
      <section className="panel">
        <h1 className="font-display text-2xl font-bold">Customers</h1>
        <p className="mt-1 text-sm text-ink-800/70">
          Consent is required before messaging. CSV import never auto-sends.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={onCreate}>
          <input
            className="input"
            data-testid="customer-name"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="input"
            data-testid="customer-phone"
            placeholder="+14155550123"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <button className="btn-primary" data-testid="customer-add" type="submit">
            Add customer
          </button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            className="input max-w-xs"
            data-testid="customer-search"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn-secondary" type="button" onClick={() => void load()}>
            Search
          </button>
          <label className="btn-secondary cursor-pointer">
            Import CSV
            <input
              data-testid="csv-input"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
              }}
            />
          </label>
        </div>
        {message && (
          <p className="mt-3 text-sm text-moss-500" data-testid="customer-message">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-coral-600" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="panel overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="customers-table">
          <thead>
            <tr className="border-b border-ink-800/10 text-ink-800/60">
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Phone</th>
              <th className="py-2 font-medium">Consent</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr
                key={c.id}
                className="border-b border-ink-800/5"
                data-testid={`customer-row-${c.id}`}
              >
                <td className="py-2 pr-3">{c.name}</td>
                <td className="py-2 pr-3">{c.phoneE164}</td>
                <td className="py-2">{c.consentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
