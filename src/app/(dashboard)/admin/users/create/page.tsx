'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Eye, EyeOff, Copy, Check, Mail, User, Lock, Phone } from 'lucide-react';
import Link from 'next/link';

export default function AdminCreateClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ email: string; password: string; name: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({
    displayName: '',
    email: '',
    phone: '',
    password: '',
    role: 'client' as 'client' | 'doctor',
    sendWelcomeEmail: false,
  });

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pwd = '';
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setForm(f => ({ ...f, password: pwd }));
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async () => {
    if (!form.displayName.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Name, email, and password are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create account');
      setSuccess({ email: form.email, password: form.password, name: form.displayName });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 4px rgba(30,56,16,0.07)' }}>
          <div style={{ height: '4px', background: 'linear-gradient(90deg, #8DC63F, #2A4A1A)' }} />
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(141,198,63,0.1)' }}>
              <Check size={28} style={{ color: '#8DC63F' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '24px', color: '#1E3810', marginBottom: '8px' }}>
              Account Created!
            </h2>
            <p className="text-sm mb-6" style={{ color: '#4A5568' }}>
              Share these credentials with <strong>{success.name}</strong> securely.
            </p>

            <div className="rounded-xl p-5 mb-6 text-left space-y-4" style={{ background: '#F4F4F6', border: '1px solid rgba(30,56,16,0.08)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#8A9BA8' }}>Login Credentials</p>

              <div>
                <p className="text-xs font-medium mb-1" style={{ color: '#4A5568' }}>Email</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm px-3 py-2 rounded-lg" style={{ background: 'white', color: '#1E3810', border: '1px solid rgba(30,56,16,0.1)' }}>
                    {success.email}
                  </code>
                  <button onClick={() => copyToClipboard(success.email, 'email')}
                    className="p-2 rounded-lg transition-all hover:bg-black/5" style={{ color: copied === 'email' ? '#8DC63F' : '#8A9BA8' }}>
                    {copied === 'email' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium mb-1" style={{ color: '#4A5568' }}>Password</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm px-3 py-2 rounded-lg" style={{ background: 'white', color: '#1E3810', border: '1px solid rgba(30,56,16,0.1)' }}>
                    {success.password}
                  </code>
                  <button onClick={() => copyToClipboard(success.password, 'password')}
                    className="p-2 rounded-lg transition-all hover:bg-black/5" style={{ color: copied === 'password' ? '#8DC63F' : '#8A9BA8' }}>
                    {copied === 'password' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t" style={{ borderColor: 'rgba(30,56,16,0.08)' }}>
                <p className="text-xs" style={{ color: '#8A9BA8' }}>
                  Login URL: <strong style={{ color: '#1E3810' }}>www.valeoexperience.com/login</strong>
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setSuccess(null); setForm({ displayName: '', email: '', phone: '', password: '', role: 'client', sendWelcomeEmail: false }); }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(42,74,26,0.06)', color: '#2A4A1A' }}>
                Create Another
              </button>
              <Link href="/admin/users"
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-center transition-all"
                style={{ background: 'linear-gradient(135deg, #2A4A1A, #3D6B24)', color: 'white', textDecoration: 'none' }}>
                View All Users
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Back */}
      <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-70 transition-opacity"
        style={{ color: '#4A5568', textDecoration: 'none' }}>
        <ArrowLeft size={15} /> Back to Users
      </Link>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 4px rgba(30,56,16,0.07)' }}>
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #8DC63F, #2A4A1A)' }} />
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(141,198,63,0.1)' }}>
              <UserPlus size={20} style={{ color: '#8DC63F' }} />
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '22px', color: '#1E3810' }}>Create Account</h1>
              <p className="text-xs" style={{ color: '#8A9BA8' }}>Admin-controlled — user receives credentials directly</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 mb-5 text-sm" style={{ background: 'rgba(247,148,29,0.08)', color: '#F7941D', border: '1px solid rgba(247,148,29,0.2)' }}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Role */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8A9BA8' }}>Account Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['client', 'doctor'] as const).map(r => (
                  <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                    className="py-3 rounded-xl text-sm font-semibold capitalize transition-all"
                    style={{
                      background: form.role === r ? 'linear-gradient(135deg, #2A4A1A, #3D6B24)' : 'rgba(42,74,26,0.05)',
                      color: form.role === r ? 'white' : '#4A5568',
                      border: form.role === r ? 'none' : '1px solid rgba(42,74,26,0.1)'
                    }}>
                    {r === 'client' ? '🧑 Client' : '👩‍⚕️ Doctor'}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8A9BA8' }}>Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#8A9BA8' }} />
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#F8F9FA', border: '1px solid rgba(30,56,16,0.1)', color: '#1E3810' }}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8A9BA8' }}>Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#8A9BA8' }} />
                <input
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#F8F9FA', border: '1px solid rgba(30,56,16,0.1)', color: '#1E3810' }}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8A9BA8' }}>Phone (optional)</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#8A9BA8' }} />
                <input
                  type="tel"
                  placeholder="+1 (784) 000-0000"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: '#F8F9FA', border: '1px solid rgba(30,56,16,0.1)', color: '#1E3810' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8A9BA8' }}>Temporary Password</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#8A9BA8' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: '#F8F9FA', border: '1px solid rgba(30,56,16,0.1)', color: '#1E3810' }}
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8A9BA8' }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button onClick={generatePassword}
                  className="px-4 py-3 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                  style={{ background: 'rgba(141,198,63,0.1)', color: '#2A4A1A', border: '1px solid rgba(141,198,63,0.2)' }}>
                  Generate
                </button>
              </div>
              <p className="text-xs mt-1.5" style={{ color: '#8A9BA8' }}>
                User should change this on first login.
              </p>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all mt-2"
              style={{
                background: loading ? 'rgba(42,74,26,0.4)' : 'linear-gradient(135deg, #2A4A1A, #3D6B24)',
                color: 'white',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(42,74,26,0.25)',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}>
              {loading ? 'Creating Account…' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
