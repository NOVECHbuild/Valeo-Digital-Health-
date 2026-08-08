'use client';

// src/app/payment/failed/page.tsx

import Link from 'next/link';
import { XCircle, RefreshCw, MessageCircle } from 'lucide-react';

export default function PaymentFailedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 safe-pb"
      style={{ background: 'linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)' }}>
      <div className="rounded-3xl p-8 sm:p-10 text-center max-w-sm w-full"
        style={{ background: 'white', boxShadow: '0 20px 60px rgba(42,74,26,0.25)' }}>

        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(247,148,29,0.1)' }}>
          <XCircle size={32} style={{ color: '#F7941D' }} />
        </div>

        <h2 className="text-2xl mb-2"
          style={{ fontFamily: 'var(--font-dm-serif)', color: '#2A4A1A' }}>
          Payment Failed
        </h2>
        <p className="text-sm mb-6" style={{ color: '#8A9BA8' }}>
          Your payment could not be completed. No charge was made to your card.
          Your time slot may still be held briefly — return to Appointments to try again, or book a new time if the hold has expired.
        </p>

        {/* Retry */}
        <Link href="/client/appointments"
          className="flex items-center justify-center gap-2 w-full py-3 min-h-[48px] rounded-2xl text-sm font-semibold text-white mb-3 transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #2A4A1A, #3D6B24)' }}>
          <RefreshCw size={15} /> Try Again
        </Link>

        {/* Support */}
        <a href="mailto:support@valeoexperience.com"
          className="flex items-center justify-center gap-2 w-full py-3 min-h-[48px] rounded-2xl text-sm font-semibold mb-3"
          style={{ background: 'rgba(42,74,26,0.06)', color: '#2A4A1A' }}>
          <MessageCircle size={15} /> Contact Support
        </a>

        <Link href="/client" className="text-xs" style={{ color: '#C4C4C4' }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
