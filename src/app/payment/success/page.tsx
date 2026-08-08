'use client';

// src/app/payment/success/page.tsx

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { authedFetch } from '@/lib/authedFetch';
import { CheckCircle, Calendar, Video, ArrowRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import JoinSessionLink from '@/components/JoinSessionLink';
import { JOIN_EARLY_MINUTES, useCanJoinSession } from '@/lib/joinWindow';

// ── Shared loading card ───────────────────────────────────────────────────────
function LoadingCard() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 safe-pb"
      style={{ background: 'linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)' }}>
      <div className="rounded-3xl p-8 sm:p-10 text-center max-w-sm w-full"
        style={{ background: 'white', boxShadow: '0 20px 60px rgba(42,74,26,0.25)' }}>
        <Loader2 size={36} className="animate-spin mx-auto" style={{ color: '#8DC63F' }} />
      </div>
    </div>
  );
}

// ── Inner component — useSearchParams() is safe inside Suspense ──────────────
function SuccessContent() {
  const searchParams   = useSearchParams();
  const orderId        = searchParams.get('order_id') ?? '';
  const appointmentIdQ = searchParams.get('appointment_id') ?? '';
  const sessionIdQ     = searchParams.get('session_id') ?? '';

  const [meetLink,    setMeetLink]    = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string>('');
  const [sessionTime, setSessionTime] = useState<string>('');
  const [sessionDuration, setSessionDuration] = useState<number>(60);
  const [sessionType, setSessionType] = useState<string>('Therapy Session');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [retryKey,    setRetryKey]    = useState(0);
  const canJoin = useCanJoinSession({
    date: sessionDate,
    time: sessionTime,
    duration: sessionDuration,
    meetLink,
    status: 'approved',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Confirm with Stripe in case the webhook was delayed / misconfigured.
        if (sessionIdQ.startsWith('cs_')) {
          try {
            await authedFetch('/api/payments/confirm-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: sessionIdQ }),
            });
          } catch (err) {
            console.warn('[Payment success] confirm-session fallback failed:', err);
          }
        }

        let appointmentId = appointmentIdQ;

        if (orderId) {
          const paySnap = await getDoc(doc(db, 'payments', orderId));
          if (cancelled) return;
          if (paySnap.exists()) {
            const pay = paySnap.data();
            setSessionType(pay.sessionType ?? 'Therapy Session');
            if (pay.appointmentId) appointmentId = pay.appointmentId;
          }
        }

        if (appointmentId) {
          const apptSnap = await getDoc(doc(db, 'appointments', appointmentId));
          if (cancelled) return;
          if (apptSnap.exists()) {
            const a = apptSnap.data();
            setMeetLink(a.meetLink ?? null);
            setSessionDate(a.date  ?? '');
            setSessionTime(a.time ?? '');
            setSessionDuration(typeof a.duration === 'number' ? a.duration : 60);
            if (a.sessionType) setSessionType(a.sessionType);
            else if (a.type) setSessionType(a.type);
          }
        }
      } catch (err) {
        console.error('[Payment success] load details:', err);
        if (!cancelled) {
          setError('We confirmed your payment, but could not load session details. You can retry or open your appointments.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId, appointmentIdQ, sessionIdQ, retryKey]);

  function fmtDate(d: string) {
    if (!d) return '';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  if (loading) return <LoadingCard />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 safe-pb"
        style={{ background: 'linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)' }}>
        <div className="rounded-3xl p-8 sm:p-10 text-center max-w-sm w-full"
          style={{ background: 'white', boxShadow: '0 20px 60px rgba(42,74,26,0.25)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(247,148,29,0.1)' }}>
            <AlertCircle size={32} style={{ color: '#F7941D' }} />
          </div>
          <h2 className="text-2xl mb-2"
            style={{ fontFamily: 'var(--font-dm-serif)', color: '#2A4A1A' }}>
            Payment received
          </h2>
          <p className="text-sm mb-6" style={{ color: '#8A9BA8' }}>{error}</p>
          <button
            type="button"
            onClick={() => setRetryKey(k => k + 1)}
            className="flex items-center justify-center gap-2 w-full py-3 min-h-[48px] rounded-2xl text-sm font-semibold text-white mb-3 transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #2A4A1A, #3D6B24)' }}
          >
            <RefreshCw size={15} /> Retry loading details
          </button>
          <Link href="/client/appointments"
            className="flex items-center justify-center gap-2 w-full py-3 min-h-[48px] rounded-2xl text-sm font-semibold mb-3 transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(42,74,26,0.06)', color: '#2A4A1A' }}>
            <Calendar size={15} /> View My Appointments <ArrowRight size={13} />
          </Link>
          <Link href="/client" className="text-xs" style={{ color: '#C4C4C4' }}>
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 safe-pb"
      style={{ background: 'linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)' }}>
      <div className="rounded-3xl p-8 sm:p-10 text-center max-w-sm w-full"
        style={{ background: 'white', boxShadow: '0 20px 60px rgba(42,74,26,0.25)' }}>

        {/* Success icon */}
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(141,198,63,0.12)' }}>
          <CheckCircle size={32} style={{ color: '#6BA028' }} />
        </div>

        <h2 className="text-2xl mb-2"
          style={{ fontFamily: 'var(--font-dm-serif)', color: '#2A4A1A' }}>
          Payment Successful!
        </h2>
        <p className="text-sm mb-6" style={{ color: '#8A9BA8' }}>
          Your {sessionType.toLowerCase()} has been confirmed.
          {sessionDate && ` We'll see you on ${fmtDate(sessionDate)}.`}
        </p>

        {/* Meet link — only in the pre-session join window */}
        {meetLink && canJoin && (
          <JoinSessionLink
            href={meetLink}
            className="flex items-center justify-center gap-2 w-full py-3 min-h-[48px] rounded-2xl text-sm font-semibold text-white mb-3 transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #8DC63F, #6BA028)' }}
          >
            <Video size={15} /> Join Session
          </JoinSessionLink>
        )}
        {meetLink && !canJoin && (
          <p className="text-xs mb-4" style={{ color: '#8A9BA8' }}>
            Join Session opens {JOIN_EARLY_MINUTES} minutes before your appointment.
          </p>
        )}

        {/* View appointments */}
        <Link href="/client/appointments"
          className="flex items-center justify-center gap-2 w-full py-3 min-h-[48px] rounded-2xl text-sm font-semibold mb-3 transition-all hover:-translate-y-0.5"
          style={{ background: 'rgba(42,74,26,0.06)', color: '#2A4A1A' }}>
          <Calendar size={15} /> View My Appointments <ArrowRight size={13} />
        </Link>

        <Link href="/client"
          className="text-xs" style={{ color: '#C4C4C4' }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

// ── Page export — Suspense required for useSearchParams() ────────────────────
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <SuccessContent />
    </Suspense>
  );
}
