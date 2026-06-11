'use client';

// src/app/payment/success/page.tsx

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, Calendar, Video, ArrowRight, Loader2 } from 'lucide-react';

// ── Shared loading card ───────────────────────────────────────────────────────
function LoadingCard() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)' }}>
      <div className="rounded-3xl p-10 text-center max-w-sm w-full"
        style={{ background: 'white', boxShadow: '0 20px 60px rgba(42,74,26,0.25)' }}>
        <Loader2 size={36} className="animate-spin mx-auto" style={{ color: '#8DC63F' }} />
      </div>
    </div>
  );
}

// ── Inner component — useSearchParams() is safe inside Suspense ──────────────
function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId      = searchParams.get('order_id') ?? '';

  const [meetLink,    setMeetLink]    = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string>('');
  const [sessionType, setSessionType] = useState<string>('Therapy Session');
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    (async () => {
      try {
        const paySnap = await getDoc(doc(db, 'payments', orderId));
        if (!paySnap.exists()) return;
        const pay = paySnap.data();
        setSessionType(pay.sessionType ?? 'Therapy Session');

        if (pay.appointmentId) {
          const apptSnap = await getDoc(doc(db, 'appointments', pay.appointmentId));
          if (apptSnap.exists()) {
            const a = apptSnap.data();
            setMeetLink(a.meetLink ?? null);
            setSessionDate(a.date  ?? '');
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  function fmtDate(d: string) {
    if (!d) return '';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  if (loading) return <LoadingCard />;

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)' }}>
      <div className="rounded-3xl p-10 text-center max-w-sm w-full"
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

        {/* Meet link if already generated */}
        {meetLink && (
          <a href={meetLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold text-white mb-3 transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #8DC63F, #6BA028)' }}>
            <Video size={15} /> Join Google Meet
          </a>
        )}

        {/* View appointments */}
        <Link href="/client/appointments"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold mb-3 transition-all hover:-translate-y-0.5"
          style={{ background: 'rgba(42,74,26,0.06)', color: '#2A4A1A' }}>
          <Calendar size={15} /> View My Appointments <ArrowRight size={13} />
        </Link>

        <Link href="/client/dashboard"
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
