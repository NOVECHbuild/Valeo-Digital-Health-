'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  User, Lock, Eye, EyeOff,
  Check, AlertCircle, Shield, Loader2,
  Bell, CheckCircle, AlertTriangle, ArrowRight,
} from 'lucide-react';

// ══════════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════════
type UserRole = 'admin' | 'doctor' | 'client';

interface NotifPrefs {
  emailAppointments: boolean;
  emailMessages:     boolean;
  emailAssessments:  boolean;
  pushEnabled:       boolean;
  pushAppointments:  boolean;
  pushMessages:      boolean;
  pushAssessments:   boolean;
  pushReminders:     boolean;
}

// ── Theme derived from role ───────────────────────────────────────────────────
function getAccentForRole(role: UserRole): { accent: string; accentLight: string } {
  switch (role) {
    case 'admin':  return { accent: '#F7941D', accentLight: '#C4700A' };
    case 'doctor': return { accent: '#2A4A1A', accentLight: '#3D6B24' };
    default:       return { accent: '#F7941D', accentLight: '#C4700A' };
  }
}

// ── Hex-alpha safe helper ─────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const map: Record<string, string> = {
    '#F7941D': `rgba(247,148,29,${alpha})`,
    '#2A4A1A': `rgba(42,74,26,${alpha})`,
    '#8DC63F': `rgba(141,198,63,${alpha})`,
    '#3D6B24': `rgba(61,107,36,${alpha})`,
    '#C4700A': `rgba(196,77,58,${alpha})`,
  };
  return map[hex] ?? `rgba(42,74,26,${alpha})`;
}

// ── First + last initial ──────────────────────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

// ══════════════════════════════════════════════════════════════
//  PAGE COMPONENT  — no props (Next.js 14 App Router requirement)
// ══════════════════════════════════════════════════════════════
export default function AccountSettingsPage() {
  const { user } = useAuth();

  // ── Role + theme (derived from Firestore) ─────────────────────────────────
  const [role,       setRole]       = useState<UserRole>('client');
  const [accent,     setAccent]     = useState('#F7941D');
  const [accentLight,setAccentLight]= useState('#C4700A');

  // ── Display name (for Profile link card only — edits live on Profile page)
  const [displayName, setDisplayName] = useState('');
  const [loadError,   setLoadError]   = useState<string | null>(null);

  // ── Password ──────────────────────────────────────────────────────────────
  const [pwCurrent,   setPwCurrent]   = useState('');
  const [pwNew,       setPwNew]       = useState('');
  const [pwConfirm,   setPwConfirm]   = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifs, setNotifs] = useState<NotifPrefs>({
    emailAppointments: true,
    emailMessages:     true,
    emailAssessments:  true,
    pushEnabled:       false,
    pushAppointments:  true,
    pushMessages:      true,
    pushAssessments:   true,
    pushReminders:     true,
  });
  const [notifsDirty, setNotifsDirty] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  // ── Status ────────────────────────────────────────────────────────────────
  const [passwordStatus, setPasswordStatus] = useState<'idle'|'saving'|'success'|'error'>('idle');
  const [notifStatus,    setNotifStatus]    = useState<'idle'|'saving'|'success'|'error'>('idle');
  const [passwordError,  setPasswordError]  = useState('');

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── Timer refs (cleared on unmount) ───────────────────────────────────────
  const toastTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      [toastTimerRef, passwordTimerRef, notifTimerRef].forEach(ref => {
        if (ref.current) clearTimeout(ref.current);
      });
    };
  }, []);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }

  function scheduleReset(
    setter: (v: 'idle') => void,
    ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    delay = 3000,
  ) {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => setter('idle'), delay);
  }

  // ══════════════════════════════════════════════════════════════
  //  Load role + notifs from Firestore (name for Profile link card)
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data() ?? {};

        setDisplayName(user.displayName || data.displayName || '');

        const firestoreRole: UserRole = data.role ?? 'client';
        setRole(firestoreRole);
        const { accent: a, accentLight: al } = getAccentForRole(firestoreRole);
        setAccent(a);
        setAccentLight(al);

        if (data.notifPrefs) {
          setNotifs(prev => ({ ...prev, ...data.notifPrefs }));
        }
      } catch (err) {
        console.error('[AccountSettings] load:', err);
        setLoadError('Could not load your settings. Please refresh the page.');
      }
    })();
  }, [user]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const strength = (() => {
    if (!pwNew) return 0;
    let s = 0;
    if (pwNew.length >= 8)           s++;
    if (pwNew.length >= 12)          s++;
    if (/[A-Z]/.test(pwNew))         s++;
    if (/[0-9]/.test(pwNew))         s++;
    if (/[^A-Za-z0-9]/.test(pwNew))  s++;
    return s;
  })();
  const strengthLabel = ['', 'Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const strengthColor = ['', '#F7941D', '#F7941D', '#F7941D', '#8DC63F', '#2A4A1A'];

  const roleLabel    = role === 'admin' ? 'Administrator' : role === 'doctor' ? 'Doctor' : 'Client';
  const roleBadgeCol = role === 'admin' ? '#F7941D' : role === 'doctor' ? '#2A4A1A' : '#8DC63F';

  const lastLogin = user?.metadata?.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  // ── Change password ───────────────────────────────────────────────────────
  async function handleChangePassword() {
    setPasswordError('');
    if (!pwCurrent)          { setPasswordError('Please enter your current password.'); return; }
    if (pwNew.length < 8)    { setPasswordError('New password must be at least 8 characters.'); return; }
    if (pwNew !== pwConfirm) { setPasswordError('New passwords do not match.'); return; }
    if (pwNew === pwCurrent) { setPasswordError('New password must differ from your current one.'); return; }
    if (strength < 2)        { setPasswordError('Please choose a stronger password.'); return; }

    setPasswordStatus('saving');
    try {
      if (auth.currentUser?.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, pwCurrent);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, pwNew);
      }
      setPasswordStatus('success');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
      showToast('Password changed successfully.');
      scheduleReset(setPasswordStatus, passwordTimerRef, 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setPasswordError('Current password is incorrect.');
      } else {
        setPasswordError('Failed to change password. Please try again.');
      }
      setPasswordStatus('error');
      scheduleReset(setPasswordStatus, passwordTimerRef, 4000);
    }
  }

  // ── Save notification prefs ───────────────────────────────────────────────
  async function handleSaveNotifs() {
    if (!user) return;
    setNotifStatus('saving');
    try {
      // Enabling master push may need browser permission + FCM token
      if (notifs.pushEnabled) {
        setPushBusy(true);
        const { enablePush } = await import('@/lib/push');
        const res = await enablePush(user.uid);
        setPushBusy(false);
        if (!res.ok) {
          setNotifs(p => ({ ...p, pushEnabled: false }));
          showToast(res.error || 'Could not enable push notifications.', 'error');
          setNotifStatus('error');
          scheduleReset(setNotifStatus, notifTimerRef, 4000);
          return;
        }
      } else {
        setPushBusy(true);
        const { disablePush } = await import('@/lib/push');
        await disablePush(user.uid);
        setPushBusy(false);
      }

      await updateDoc(doc(db, 'users', user.uid), {
        notifPrefs: notifs,
        updatedAt:  serverTimestamp(),
      });
      setNotifsDirty(false);
      setNotifStatus('success');
      showToast('Notification preferences saved.');
      scheduleReset(setNotifStatus, notifTimerRef, 3000);
    } catch {
      setPushBusy(false);
      setNotifStatus('error');
      scheduleReset(setNotifStatus, notifTimerRef, 4000);
    }
  }

  function toggleNotif(key: keyof NotifPrefs) {
    setNotifs(p => ({ ...p, [key]: !p[key] }));
    setNotifsDirty(true);
  }

  const displayedName = role === 'doctor' && displayName
    ? displayName.startsWith('Dr.') ? displayName : `Dr. ${displayName}`
    : displayName || 'Your Name';

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium"
          style={{ background: toast.type === 'success' ? '#2A4A1A' : '#F7941D', color: 'white' }}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Subtitle only — page name lives in the sticky header */}
      <p style={{ fontSize: '14px', color: '#8A9BA8' }}>
        Password and email notification preferences. Personal details live in Profile.
      </p>

      {/* Load error banner */}
      {loadError && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(247,148,29,0.06)', border: '1px solid rgba(247,148,29,0.15)' }}
        >
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#F7941D' }} />
          <p className="text-sm" style={{ color: '#F7941D' }}>{loadError}</p>
        </div>
      )}

      {/* ── PROFILE POINTER ────────────────────────────────────── */}
      <Link href="/client/profile"
        className="rounded-2xl overflow-hidden block transition-all hover:-translate-y-0.5"
        style={{ background: 'white', boxShadow: '0 1px 4px rgba(42,74,26,0.07)' }}>
        <div style={{ height: '3px', background: `linear-gradient(90deg, ${accent}, ${accentLight})` }} />
        <div className="p-5 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accentLight})`,
              color: 'white',
            }}
          >
            {getInitials(displayName || user?.email || '?')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: '#2A4A1A' }}>
              {displayedName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#8A9BA8' }}>
              Edit name, phone, goals, and emergency contact in Profile
            </p>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold flex-shrink-0"
            style={{ color: '#2A4A1A' }}>
            Profile <ArrowRight size={12} />
          </span>
        </div>
      </Link>

      {/* ── PASSWORD CARD ─────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'white', boxShadow: '0 1px 4px rgba(42,74,26,0.07)' }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #F7941D, #F7941D)' }} />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Lock size={18} style={{ color: '#F7941D' }} />
            <h2 className="text-base font-semibold" style={{ color: '#2A4A1A' }}>Change Password</h2>
          </div>

          <div className="space-y-4">
            {/* Current */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#8A9BA8' }}>Current Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: '#8A9BA8' }} />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={pwCurrent}
                  onChange={e => setPwCurrent(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#F8F9FA', border: '1px solid rgba(42,74,26,0.1)', color: '#2A4A1A' }}
                />
                <button type="button" onClick={() => setShowCurrent(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
                  style={{ color: '#8A9BA8' }}>
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#8A9BA8' }}>New Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: '#8A9BA8' }} />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={pwNew}
                  onChange={e => setPwNew(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && pwConfirm && handleChangePassword()}
                  placeholder="Min. 8 characters"
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none"
                  style={{ background: '#F8F9FA', border: '1px solid rgba(42,74,26,0.1)', color: '#2A4A1A' }}
                />
                <button type="button" onClick={() => setShowNew(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
                  style={{ color: '#8A9BA8' }}>
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {pwNew && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all"
                        style={{ background: i <= strength ? strengthColor[strength] : 'rgba(42,74,26,0.08)' }} />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strengthColor[strength] }}>
                    {strengthLabel[strength]}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#8A9BA8' }}>Confirm New Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: '#8A9BA8' }} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={pwConfirm}
                  onChange={e => setPwConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                  placeholder="Re-enter new password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none"
                  style={{
                    background: '#F8F9FA',
                    border: `1px solid ${pwConfirm && pwConfirm !== pwNew ? 'rgba(247,148,29,0.4)' : 'rgba(42,74,26,0.1)'}`,
                    color: '#2A4A1A',
                  }}
                />
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
                  style={{ color: '#8A9BA8' }}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {pwConfirm && pwConfirm !== pwNew && (
                <p className="text-xs mt-1" style={{ color: '#F7941D' }}>Passwords do not match</p>
              )}
              {pwConfirm && pwConfirm === pwNew && pwNew && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#8DC63F' }}>
                  <Check size={11} /> Passwords match
                </p>
              )}
            </div>

            {passwordError && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(247,148,29,0.08)', color: '#F7941D', border: '1px solid rgba(247,148,29,0.15)' }}
              >
                <AlertCircle size={15} />{passwordError}
              </div>
            )}

            <button
              onClick={handleChangePassword}
              disabled={passwordStatus === 'saving'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
              style={{
                background: passwordStatus === 'success'
                  ? 'rgba(141,198,63,0.1)'
                  : 'linear-gradient(135deg, #F7941D, #C4700A)',
                color:     passwordStatus === 'success' ? '#8DC63F' : 'white',
                boxShadow: passwordStatus === 'success' ? 'none' : '0 4px 14px rgba(247,148,29,0.3)',
                cursor:    passwordStatus === 'saving' ? 'not-allowed' : 'pointer',
              }}
            >
              {passwordStatus === 'saving'  ? <><Loader2 size={14} className="animate-spin" />Updating…</>
             : passwordStatus === 'success' ? <><Check size={14} />Password Changed!</>
             : <><Lock size={14} />Change Password</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── NOTIFICATION PREFERENCES ───────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'white', boxShadow: '0 1px 4px rgba(42,74,26,0.07)' }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #8DC63F, #2A4A1A)' }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Bell size={18} style={{ color: '#8DC63F' }} />
              <h2 className="text-base font-semibold" style={{ color: '#2A4A1A' }}>
                Notification Preferences
              </h2>
            </div>
            {notifsDirty && (
              <span className="text-xs font-medium" style={{ color: '#C4700A' }}>Unsaved</span>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8A9BA8' }}>Email</p>
            {([
              { key: 'emailAppointments', label: 'Appointment updates',  sub: 'Confirmations, reminders, and cancellations' },
              { key: 'emailMessages',     label: 'New messages',         sub: 'When you receive a new chat message'         },
              { key: 'emailAssessments',  label: 'Assessment activity',  sub: 'When an assessment is assigned or completed'  },
            ] as { key: keyof NotifPrefs; label: string; sub: string }[]).map(({ key, label, sub }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#2A4A1A' }}>{label}</p>
                  <p className="text-xs" style={{ color: '#8A9BA8' }}>{sub}</p>
                </div>
                <button
                  onClick={() => toggleNotif(key)}
                  className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                  style={{ background: 'transparent' }}
                  aria-pressed={notifs[key]}
                >
                  <span className="relative w-11 h-6 rounded-full block" style={{ background: notifs[key] ? accent : 'rgba(42,74,26,0.12)' }}>
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: notifs[key] ? '24px' : '4px' }}
                    />
                  </span>
                </button>
              </div>
            ))}

            <div className="pt-2 border-t" style={{ borderColor: 'rgba(42,74,26,0.06)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#8A9BA8' }}>Push (phone / PWA)</p>
              <p className="text-xs mb-3" style={{ color: '#8A9BA8' }}>
                On iPhone, install Valeo to your Home Screen for push to work. Android Chrome can prompt after you enable.
              </p>
            </div>
            {([
              { key: 'pushEnabled',      label: 'Enable push notifications', sub: 'Allow Valeo to send alerts to this device' },
              { key: 'pushAppointments', label: 'Appointment push',          sub: 'Confirmations and cancellations' },
              { key: 'pushReminders',    label: 'Session reminders',         sub: 'Push reminder for sessions today / tomorrow' },
              { key: 'pushMessages',     label: 'Message push',              sub: 'When you receive a new chat message' },
              { key: 'pushAssessments',  label: 'Assessment push',           sub: 'When an assessment is assigned' },
            ] as { key: keyof NotifPrefs; label: string; sub: string }[]).map(({ key, label, sub }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#2A4A1A' }}>{label}</p>
                  <p className="text-xs" style={{ color: '#8A9BA8' }}>{sub}</p>
                </div>
                <button
                  onClick={() => toggleNotif(key)}
                  disabled={key !== 'pushEnabled' && !notifs.pushEnabled}
                  className="relative flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-40"
                  aria-pressed={notifs[key]}
                >
                  <span className="relative w-11 h-6 rounded-full block" style={{ background: notifs[key] ? accent : 'rgba(42,74,26,0.12)' }}>
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: notifs[key] ? '24px' : '4px' }}
                    />
                  </span>
                </button>
              </div>
            ))}

            <button
              onClick={handleSaveNotifs}
              disabled={notifStatus === 'saving' || pushBusy || !notifsDirty}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 min-h-[44px]"
              style={{
                background: notifStatus === 'success'
                  ? 'rgba(141,198,63,0.1)'
                  : 'linear-gradient(135deg, #8DC63F, #2A4A1A)',
                color:  notifStatus === 'success' ? '#8DC63F' : 'white',
                cursor: (notifStatus === 'saving' || !notifsDirty) ? 'not-allowed' : 'pointer',
              }}
            >
              {notifStatus === 'saving'  ? <><Loader2 size={14} className="animate-spin" />Saving…</>
             : notifStatus === 'success' ? <><Check size={14} />Saved!</>
             : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>

      {/* ── ACCOUNT INFO ───────────────────────────────────────── */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(42,74,26,0.03)', border: '1px solid rgba(42,74,26,0.06)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#8A9BA8' }}>
          Account Info
        </p>
        <div className="space-y-3">
          {[
            { label: 'Account ID',     value: user?.uid ? `${user.uid.slice(0, 16)}…` : '—', mono: true },
            { label: 'Role',           value: roleLabel, color: roleBadgeCol },
            {
              label: 'Email Verified',
              value: user?.emailVerified ? '✓ Verified' : '✗ Not verified',
              color: user?.emailVerified ? '#8DC63F' : '#F7941D',
            },
            { label: 'Last Sign In',   value: lastLogin ?? '—' },
          ].map(({ label, value, color, mono }) => (
            <div key={label} className="flex items-center justify-between text-sm"
              style={{ borderBottom: '1px solid rgba(42,74,26,0.05)', paddingBottom: '10px' }}>
              <span style={{ color: '#4A5568' }}>{label}</span>
              <span
                className={mono ? 'font-mono text-xs' : 'font-medium text-xs'}
                style={{ color: color ?? '#8A9BA8' }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
