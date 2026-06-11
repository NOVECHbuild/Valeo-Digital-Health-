'use client';

// src/app/(dashboard)/client/pay/[appointmentId]/page.tsx
// Shows a payment summary and initiates the WiPay redirect.
// Called from the appointments page "Pay Now" button.

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
  CreditCard, Lock, Loader2, AlertCircle,
  Calendar, Clock, ArrowRight, ShieldCheck,
} from 'lucide-react';

interface AppointmentDetails {
  sessionType:  string;
  sessionDate:  string;
  sessionTime:  string;
  amount:       number;
  doctorId:     string;
  doctorName:   string;
}

export default function ClientPayPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user }          = useAuth();
  const router            = useRouter();

  const [appt,     setAppt]     = useState<AppointmentDetails | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [paying,   setPaying]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // ── Load appointment details ───────────────────────────────────────────
  useEffect(() => {
    if (!appointmentId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'appointments', appointmentId));
        if (!snap.exists()) { setError('Appointment not found.'); return; }

        const d = snap.data();

        // Guard: already paid
        if (d.status === 'approved' || d.status === 'completed') {
          router.replace('/client/appointments');
          return;
        }

        setAppt({
          sessionType: d.sessionType ?? 'Therapy Session',
          sessionDate: d.date        ?? '',
          sessionTime: d.time        ?? '',
          amount:      d.amount      ?? 150,
          doctorId:    d.doctorId    ?? '',
          doctorName:  d.doctorName  ?? 'Dr. Miller',
        });
      } catch (err) {
        console.error('[Pay] load appointment:', err);
        setError('Could not load appointment details. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [appointmentId, router]);

  // ── Initiate WiPay payment ─────────────────────────────────────────────
  async function handlePay() {
    if (!user || !appt || !appointmentId) return;
    setPaying(true);
    setError(null);

    try {
      const res = await fetch('/api/wipay/create-payment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          appointmentId,
          clientId:    user.uid,
          clientEmail: user.email ?? '',
          doctorId:    appt.doctorId,
          amount:      appt.amount,
          sessionType: appt.sessionType,
          sessionDate: appt.sessionDate,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? 'Could not initiate payment. Please try again.');
        return;
      }

      // Redirect to WiPay hosted checkout page
      window.location.href = data.checkoutUrl;

    } catch (err) {
      console.error('[Pay] create-payment:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      // Only clear spinner if we're NOT redirecting (i.e. on error)
      if (error) setPaying(false);
    }
  }

  // ── Format helpers ─────────────────────────────────────────────────────
  function fmtDate(d: string) {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  function fmtCurrency(n: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 size={28} className="animate-spin" style={{ color: '#8DC63F' }} />
      </div>
    );
  }

  if (error && !appt) {
    return (
      <div className="max-w-md mx-auto mt-16 rounded-2xl p-8 text-center"
        style={{ background: 'white', boxShadow: '0 2px 12px rgba(42,74,26,0.08)' }}>
        <AlertCircle size={28} className="mx-auto mb-3" style={{ color: '#F7941D' }} />
        <p className="text-sm font-medium mb-1" style={{ color: '#2A4A1A' }}>{error}</p>
        <button onClick={() => router.back()} className="mt-4 text-xs underline" style={{ color: '#8A9BA8' }}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">

      {/* Header */}
      <div>
        <h2 className="text-2xl" style={{ fontFamily: 'var(--font-dm-serif)', color: '#2A4A1A' }}>
          Complete Payment
        </h2>
        <p className="text-sm mt-0.5" style={{ color: '#8A9BA8' }}>
          Review your session details before proceeding to checkout.
        </p>
      </div>

      {/* Order summary card */}
      <div className="rounded-2xl p-6"
        style={{ background: 'white', boxShadow: '0 1px 4px rgba(42,74,26,0.07)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#8A9BA8' }}>
          Order Summary
        </p>

        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(141,198,63,0.1)' }}>
              <CreditCard size={16} style={{ color: '#8DC63F' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#2A4A1A' }}>
                {appt?.sessionType}
              </p>
              <p className="text-xs" style={{ color: '#8A9BA8' }}>{appt?.doctorName}</p>
            </div>
          </div>

          {appt?.sessionDate && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(42,74,26,0.03)' }}>
              <Calendar size={13} style={{ color: '#8A9BA8' }} />
              <p className="text-xs" style={{ color: '#4A5568' }}>{fmtDate(appt.sessionDate)}</p>
            </div>
          )}

          {appt?.sessionTime && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(42,74,26,0.03)' }}>
              <Clock size={13} style={{ color: '#8A9BA8' }} />
              <p className="text-xs" style={{ color: '#4A5568' }}>{appt.sessionTime}</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t pt-4 mb-4" style={{ borderColor: 'rgba(42,74,26,0.07)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: '#4A5568' }}>Session fee</p>
            <p className="text-sm font-semibold" style={{ color: '#2A4A1A' }}>
              {fmtCurrency(appt?.amount ?? 0)}
            </p>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs" style={{ color: '#8A9BA8' }}>Processing fee</p>
            <p className="text-xs" style={{ color: '#8A9BA8' }}>Covered by Valeo</p>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t"
            style={{ borderColor: 'rgba(42,74,26,0.07)' }}>
            <p className="text-base font-bold" style={{ fontFamily: 'var(--font-dm-serif)', color: '#2A4A1A' }}>
              Total
            </p>
            <p className="text-base font-bold" style={{ fontFamily: 'var(--font-dm-serif)', color: '#2A4A1A' }}>
              {fmtCurrency(appt?.amount ?? 0)}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-4"
            style={{ background: 'rgba(247,148,29,0.08)', border: '1px solid rgba(247,148,29,0.15)' }}>
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#F7941D' }} />
            <p className="text-xs" style={{ color: '#F7941D' }}>{error}</p>
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={handlePay}
          disabled={paying || !appt}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #2A4A1A, #3D6B24)' }}
        >
          {paying ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Redirecting to checkout…
            </>
          ) : (
            <>
              <CreditCard size={16} />
              Pay {fmtCurrency(appt?.amount ?? 0)}
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>

      {/* Security note */}
      <div className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(42,74,26,0.03)', border: '1px solid rgba(42,74,26,0.07)' }}>
        <ShieldCheck size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#8DC63F' }} />
        <div>
          <p className="text-xs font-semibold mb-0.5" style={{ color: '#2A4A1A' }}>
            Secure checkout powered by WiPay
          </p>
          <p className="text-xs" style={{ color: '#8A9BA8' }}>
            You'll be redirected to WiPay's secure payment page. Your card details are never
            stored by Valeo. Supports Visa, Mastercard and local Caribbean debit cards.
          </p>
        </div>
      </div>

      <button onClick={() => router.back()} className="w-full text-xs text-center"
        style={{ color: '#8A9BA8' }}>
        ← Back to appointments
      </button>
    </div>
  );
}
