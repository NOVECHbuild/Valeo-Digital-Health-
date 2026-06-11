'use client';

import Link from 'next/link';
import { Shield, Mail, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)' }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div style={{
          position: 'absolute', top: '-10%', right: '-10%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(141,198,63,0.12) 0%, transparent 70%)'
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-5%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(247,148,29,0.1) 0%, transparent 70%)'
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl overflow-hidden" style={{
          background: 'rgba(255,255,255,0.97)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.3)'
        }}>
          {/* Top accent */}
          <div style={{ height: '4px', background: 'linear-gradient(90deg, #8DC63F, #F7941D)' }} />

          <div className="p-10">
            {/* Logo */}
            <div className="text-center mb-8">
              <p style={{
                fontFamily: 'var(--font-dm-serif)',
                fontSize: '24px',
                color: '#2A4A1A',
                marginBottom: '4px'
              }}>
                The Valeo Experience
              </p>
              <p style={{ fontSize: '11px', letterSpacing: '2.5px', textTransform: 'uppercase', color: '#8DC63F', fontWeight: 600 }}>
                Caribbean Mental Health
              </p>
            </div>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{
                background: 'linear-gradient(135deg, rgba(42,74,26,0.08), rgba(141,198,63,0.12))',
                border: '2px solid rgba(141,198,63,0.2)'
              }}>
                <Shield size={36} style={{ color: '#2A4A1A' }} />
              </div>
            </div>

            {/* Heading */}
            <div className="text-center mb-8">
              <h1 style={{
                fontFamily: 'var(--font-dm-serif)',
                fontSize: '28px',
                color: '#2A4A1A',
                marginBottom: '12px',
                lineHeight: 1.2
              }}>
                Private Beta
              </h1>
              <p style={{ fontSize: '15px', color: '#4A5568', lineHeight: 1.7 }}>
                The Valeo Experience platform is currently in a closed beta. New accounts are created by our team only.
              </p>
            </div>

            {/* Info box */}
            <div className="rounded-xl p-4 mb-8" style={{
              background: 'rgba(141,198,63,0.06)',
              border: '1px solid rgba(141,198,63,0.2)'
            }}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#2A4A1A' }}>
                Already have an account?
              </p>
              <p className="text-sm" style={{ color: '#4A5568', lineHeight: 1.6 }}>
                If you&apos;ve been given access by Dr. Miller or the Valeo team, please sign in using the button below.
              </p>
            </div>

            {/* Contact box */}
            <div className="rounded-xl p-4 mb-8" style={{
              background: 'rgba(247,148,29,0.05)',
              border: '1px solid rgba(247,148,29,0.15)'
            }}>
              <div className="flex items-start gap-3">
                <Mail size={18} style={{ color: '#F7941D', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#2A4A1A' }}>
                    Want access?
                  </p>
                  <p className="text-sm" style={{ color: '#4A5568', lineHeight: 1.6 }}>
                    Reach out to us at{' '}
                    <a
                      href="mailto:info@valeoexperience.com"
                      style={{ color: '#F7941D', fontWeight: 600, textDecoration: 'none' }}
                    >
                      info@valeoexperience.com
                    </a>
                    {' '}to request an invitation.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full text-center py-3.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: 'linear-gradient(135deg, #2A4A1A, #3D6B24)',
                  color: 'white',
                  boxShadow: '0 4px 16px rgba(42,74,26,0.3)',
                  textDecoration: 'none'
                }}
              >
                Sign In to Your Account
              </Link>
              <Link
                href="/"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all hover:bg-black/5"
                style={{ color: '#4A5568', textDecoration: 'none' }}
              >
                <ArrowLeft size={15} />
                Back to Homepage
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          © 2026 The Valeo Experience · All Rights Reserved
        </p>
      </div>
    </div>
  );
}
