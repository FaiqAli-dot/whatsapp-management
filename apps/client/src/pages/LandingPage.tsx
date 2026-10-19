import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';

type Landing = {
  businessName: string;
  draftText: string;
  googleReviewUrl: string | null;
  rating: number | null;
  simulated: boolean;
  notice: string;
};

export function LandingPage() {
  const { token } = useParams();
  const [data, setData] = useState<Landing | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [privateMsg, setPrivateMsg] = useState('');
  const [privateOk, setPrivateOk] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/v1/r/${token}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || 'Link unavailable');
        setData(json);
        setDraft(json.draftText || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
      }
    })();
  }, [token]);

  async function saveDraft() {
    const res = await fetch(`/api/v1/r/${token}/draft`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: draft }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json?.error?.message || 'Could not save');
    }
  }

  async function track(action: 'draft_copy' | 'google_click') {
    await fetch(`/api/v1/r/${token}/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  }

  async function copyDraft() {
    await saveDraft();
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      // Fallback for mobile Safari restrictions
      const ta = document.createElement('textarea');
      ta.value = draft;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
    }
    await track('draft_copy');
  }

  async function openGoogle() {
    await track('google_click');
    if (data?.googleReviewUrl) {
      window.open(data.googleReviewUrl, '_blank', 'noopener,noreferrer');
    }
  }

  async function sendPrivate(e: FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/v1/r/${token}/private-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: privateMsg }),
    });
    if (res.ok) {
      setPrivateOk(true);
      setPrivateMsg('');
    }
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-4">
        <div className="panel w-full text-center" data-testid="landing-error">
          <p className="font-display text-2xl font-bold">Link unavailable</p>
          <p className="mt-2 text-sm text-ink-800/70">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-10 text-center animate-pulseSoft">Loading…</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <div className="animate-rise panel">
        {data.simulated && <span className="sim-badge mb-3">SIMULATED</span>}
        <p className="font-display text-3xl font-bold" data-testid="landing-business">
          {data.businessName}
        </p>
        <p className="mt-2 text-sm text-ink-800/70">{data.notice}</p>
        <label className="label mt-6" htmlFor="draft">
          Your review draft
        </label>
        <textarea
          id="draft"
          className="input min-h-[140px]"
          data-testid="landing-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            className="btn-primary flex-1"
            data-testid="landing-copy"
            type="button"
            onClick={() => void copyDraft()}
          >
            {copied ? 'Copied' : 'Copy draft'}
          </button>
          <button
            className="btn-secondary flex-1"
            data-testid="landing-google"
            type="button"
            onClick={() => void openGoogle()}
            disabled={!data.googleReviewUrl}
          >
            Open Google Reviews
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-800/50">
          We never auto-publish. Opening Google does not submit a review or prefill the text.
        </p>
      </div>

      <div className="animate-rise panel mt-4" style={{ animationDelay: '120ms' }}>
        <h2 className="font-semibold">Optional private feedback</h2>
        <p className="mt-1 text-sm text-ink-800/70">Separate from your public Google review.</p>
        <form className="mt-3 space-y-3" onSubmit={(e) => void sendPrivate(e)}>
          <textarea
            className="input"
            data-testid="landing-private"
            rows={3}
            value={privateMsg}
            onChange={(e) => setPrivateMsg(e.target.value)}
          />
          <button className="btn-secondary" type="submit">
            Send privately
          </button>
        </form>
        {privateOk && (
          <p className="mt-2 text-sm text-moss-500" data-testid="landing-private-ok">
            Thanks — private feedback sent.
          </p>
        )}
      </div>
    </div>
  );
}
