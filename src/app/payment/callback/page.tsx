'use client';

// src/app/payment/callback/page.tsx
// WiPay redirects here after every transaction (success or fail).
// Query params: ?status=success&order_id=...&transaction_id=...&hash=...&total=...
// We POST them to our server-side verify-callback route for hash verification,
// then redirect to the appropriate result page.

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

// ── Inner component — useSearchParams() is safe inside Suspense ──────────────
function CallbackHandler() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const processed    = useRef(false);

  const [statusMsg, setStatusMsg] = useState('Verifying your payment…');
  const [isError,   setIsError]   = useState(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const status         = searchParams.get('status')         ?? '';
    const order_id       = searchParams.get('order_id')       ?? '';
    const transaction_id = searchParams.get('transaction_id') ?? '';
    const hash           = searchParams.get('hash')           ?? '';
    const total          = searchParams.get('total')          ?? '';
    const message        = searchParams.get('message')        ?? '';

    if (!order_id) {
      setStatusMsg('Invalid payment response.');
      setIsError(true);
      setTimeout(() => router.replace('/client/appointments'), 3000);
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/wipay/verify-callback', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status, order_id, transaction_id, hash, total, message }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          setStatusMsg(data.error ?? 'Payment verification failed.');
          setIsError(true);
          setTimeout(() => router.replace(`/payment/failed?order_id=${order_id}`), 2500);
          return;
        }

        if (data.status === 'completed') {
          setStatusMsg('Payment confirmed! Redirecting…');
          setTimeout(() => router.replace(`/payment/success?order_id=${order_id}`), 1500);
        } else {
          setStatusMsg('Payment was not completed.');
          setIsError(true);
          setTimeout(() => router.replace(`/payment/failed?order_id=${order_id}`), 2000);
        }
      } catch (err) {
        console.error('[Callback] verify error:', err);
        setStatusMsg('An error occurred verifying your payment.');
        setIsError(true);
        setTimeout(() => router.replace('/client/appointments'), 3000);
      }
    })();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)' }}>
      <div className="rounded-3xl p-10 text-center max-w-sm w-full"
        style={{ background: 'white', boxShadow: '0 20px 60px rgba(42,74,26,0.25)' }}>
        <div className="mb-5">
          {isError ? (
            <XCircle size={44} className="mx-auto" style={{ color: '#F7941D' }} />
          ) : (
            <div className="relative w-11 h-11 mx-auto">
              <Loader2 size={44} className="animate-spin" style={{ color: '#8DC63F' }} />
            </div>
          )}
        </div>
        <h2 className="text-xl mb-2" style={{ fontFamily: 'var(--font-dm-serif)', color: '#2A4A1A' }}>
          {isError ? 'Payment Issue' : 'Processing Payment'}
        </h2>
        <p className="text-sm" style={{ color: '#8A9BA8' }}>{statusMsg}</p>
      </div>
    </div>
  );
}

// ── Fallback shown during SSR / before hydration ─────────────────────────────
function CallbackFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)' }}>
      <div className="rounded-3xl p-10 text-center max-w-sm w-full"
        style={{ background: 'white', boxShadow: '0 20px 60px rgba(42,74,26,0.25)' }}>
        <div className="mb-5">
          <Loader2 size={44} className="animate-spin mx-auto" style={{ color: '#8DC63F' }} />
        </div>
        <h2 className="text-xl mb-2" style={{ fontFamily: 'var(--font-dm-serif)', color: '#2A4A1A' }}>
          Processing Payment
        </h2>
        <p className="text-sm" style={{ color: '#8A9BA8' }}>Verifying your payment…</p>
      </div>
    </div>
  );
}

// ── Page export — Suspense required for useSearchParams() ────────────────────
export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <CallbackHandler />
    </Suspense>
  );
}
