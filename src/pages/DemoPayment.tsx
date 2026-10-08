import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, Notice } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { usePageMeta } from '../lib/meta';

/** Demo-only stand-in for the Mollie payment screen. */
export default function DemoPayment() {
  usePageMeta('Testbetaling', undefined, { noindex: true });
  const { publicId = '' } = useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function settle(status: 'paid' | 'failed') {
    setBusy(true);
    try {
      await api(`/demo/pay/${encodeURIComponent(publicId)}`, { body: { status } });
      navigate(`/bestelling/${publicId}`, { replace: true });
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : 'Er ging iets mis');
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-paper-2 px-5 pt-24 pb-16 text-ink">
      <div className="w-full max-w-sm border border-paper-3 bg-white p-8">
        <p className="eyebrow text-stone-dark">Demo</p>
        <h1 className="font-display mt-3 text-2xl">Testbetaling</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-stone-dark">
          Hier zou de klant naar Mollie gaan om met iDEAL, Bancontact of creditcard te betalen. In deze demo kies je zelf de
          uitkomst.
        </p>
        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <div className="mt-6 space-y-3">
          <Button variant="dark" className="w-full" disabled={busy} onClick={() => settle('paid')}>
            Betaling geslaagd
          </Button>
          <Button variant="outline-dark" className="w-full" disabled={busy} onClick={() => settle('failed')}>
            Betaling mislukt
          </Button>
        </div>
      </div>
    </div>
  );
}
