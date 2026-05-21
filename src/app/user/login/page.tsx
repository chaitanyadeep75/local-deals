'use client';

import { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail, Lock, Zap, AlertCircle, Eye, EyeOff, Phone,
  ArrowRight, RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function OtpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const update = (idx: number, ch: string) => {
    const next = [...digits];
    next[idx] = ch;
    onChange(next.join('').replace(/\D/g, '').slice(0, 6));
    if (ch && idx < 5) refs.current[idx + 1]?.focus();
  };

  const onKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs.current[idx - 1]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text" inputMode="numeric" maxLength={1}
          value={d} disabled={disabled}
          onChange={(e) => update(i, e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className={`h-12 w-10 rounded-xl border text-center text-lg font-bold text-white outline-none transition-all duration-200 disabled:opacity-50
            ${d ? 'border-violet-500/60 bg-violet-500/15 shadow-neon-violet'
               : 'border-white/10 bg-slate-800/80 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20'}`}
          style={{ background: d ? undefined : 'rgba(30,41,59,0.8)' }}
        />
      ))}
    </div>
  );
}

type Tab = 'phone' | 'email';
type PhoneStep = 'enter' | 'otp';
type OtpChannel = 'sms' | 'whatsapp';

function UserLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [tab, setTab] = useState<Tab>('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('enter');
  const [otpChannel, setOtpChannel] = useState<OtpChannel>('sms');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const clearError = () => setError(null);

  const handleGoogle = async () => {
    setGoogleLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  const handleSendOtp = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault(); clearError();
    const formatted = '+91' + phone.trim();
    if (!/^\+91[6-9]\d{9}$/.test(formatted)) {
      setError('Enter a valid 10-digit Indian mobile number.'); return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: formatted,
      options: { channel: otpChannel },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setPhoneStep('otp'); setCountdown(30); setOtp('');
  };

  const handleVerifyOtp = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault(); clearError();
    if (otp.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: '+91' + phone.trim(), token: otp, type: 'sms',
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    localStorage.setItem('ld_role_hint', 'user');
    router.push(next);
  };

  const handleEmailLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault(); clearError(); setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); setError(error.message); return; }
    const role = data.user?.user_metadata?.role;
    if (role === 'business') {
      await supabase.auth.signOut(); setLoading(false);
      setError('This is a business account. Use Business Login instead.'); return;
    }
    if (role !== 'user') {
      const { count } = await supabase.from('deals').select('id', { count: 'exact', head: true }).eq('user_id', data.user.id);
      if ((count || 0) > 0) {
        await supabase.auth.signOut(); setLoading(false);
        setError('This is a business account. Use Business Login instead.'); return;
      }
    }
    localStorage.setItem('ld_role_hint', 'user');
    router.push(next);
  };

  const resendOtp = useCallback(async () => {
    if (countdown > 0) return;
    setError(null); setLoading(true);
    await supabase.auth.signInWithOtp({ phone: '+91' + phone.trim(), options: { channel: otpChannel } });
    setLoading(false); setCountdown(30); setOtp('');
  }, [countdown, phone, otpChannel]);

  return (
    <main className="relative min-h-screen px-4 pb-28 pt-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-600/15 blur-[90px]" />
        <div className="absolute bottom-1/3 right-1/4 h-48 w-48 rounded-full bg-teal-600/10 blur-[60px]" />
        <div className="absolute top-1/2 left-1/4 h-40 w-40 rounded-full bg-violet-600/10 blur-[60px]" />
      </div>

      <div className="relative w-full">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-violet-500" />

          <div className="p-7">
            {/* Header */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-neon-emerald">
                <Zap size={20} className="text-white" fill="white" />
              </div>
              <h1 className="text-xl font-extrabold text-white">Welcome back</h1>
              <p className="mt-1 text-sm text-slate-500">Sign in to your LocalDeals account</p>
            </div>

            {/* Google */}
            <button onClick={handleGoogle} disabled={googleLoading || loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20 disabled:opacity-50">
              {googleLoading
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                : <GoogleIcon />}
              Continue with Google
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/8" />
              <span className="text-xs font-medium text-slate-600">or</span>
              <div className="h-px flex-1 bg-white/8" />
            </div>

            {/* Tabs: Phone / Email */}
            <div className="mb-5 flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
              {(['phone', 'email'] as Tab[]).map((t) => (
                <button key={t} onClick={() => { setTab(t); setError(null); setPhoneStep('enter'); }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all capitalize
                    ${tab === t ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  {t === 'phone' ? <Phone size={13} /> : <Mail size={13} />}
                  {t === 'phone' ? 'Mobile OTP' : 'Email'}
                </button>
              ))}
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-400">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Phone tab ── */}
            <AnimatePresence mode="wait">
              {tab === 'phone' && (
                <motion.div key="phone" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  {phoneStep === 'enter' ? (
                    <form onSubmit={handleSendOtp} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Mobile Number</label>
                        <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-3 transition-all focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/20">
                          <div className="flex items-center gap-1.5 border-r border-white/10 pr-2.5 text-sm font-semibold text-slate-400">
                            🇮🇳 <span>+91</span>
                          </div>
                          <input
                            type="tel" inputMode="numeric" maxLength={10}
                            value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
                            style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }}
                            placeholder="9876543210" required />
                        </div>
                      </div>

                      {/* Channel toggle: SMS vs WhatsApp */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Send OTP via</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setOtpChannel('sms')}
                            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-all
                              ${otpChannel === 'sms'
                                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400 shadow-neon-emerald'
                                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200'}`}>
                            <Phone size={13} /> SMS
                          </button>
                          <button type="button" onClick={() => setOtpChannel('whatsapp')}
                            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-all
                              ${otpChannel === 'whatsapp'
                                ? 'border-green-500/50 bg-green-500/15 text-green-400'
                                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200'}`}>
                            <WhatsAppIcon /> WhatsApp
                          </button>
                        </div>
                        {otpChannel === 'whatsapp' && (
                          <p className="mt-1.5 text-[11px] text-slate-600">OTP will arrive as a WhatsApp message</p>
                        )}
                      </div>

                      <button type="submit" disabled={loading || phone.length !== 10}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40
                          ${otpChannel === 'whatsapp'
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-neon-emerald'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-neon-emerald'}`}>
                        {loading
                          ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          : <>{otpChannel === 'whatsapp' ? <><WhatsAppIcon /> Send via WhatsApp</> : <>Send OTP <ArrowRight size={15} /></>}</>}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                      <div className="text-center">
                        <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${otpChannel === 'whatsapp' ? 'bg-green-500/20 text-green-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {otpChannel === 'whatsapp' ? <WhatsAppIcon /> : <Phone size={18} />}
                        </div>
                        <p className="text-sm font-semibold text-white">
                          OTP sent via {otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                        </p>
                        <p className="mt-0.5 font-mono text-sm text-emerald-400">+91 {phone}</p>
                        <button type="button" onClick={() => { setPhoneStep('enter'); setOtp(''); setError(null); }}
                          className="mt-1 text-xs text-slate-500 hover:text-slate-300 underline">
                          Change number
                        </button>
                      </div>

                      <OtpInput value={otp} onChange={setOtp} disabled={loading} />

                      <button type="submit" disabled={loading || otp.length !== 6}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-bold text-white shadow-neon-emerald transition hover:opacity-90 disabled:opacity-40">
                        {loading
                          ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          : 'Verify & Sign In'}
                      </button>

                      <div className="text-center">
                        {countdown > 0 ? (
                          <p className="text-xs text-slate-600">Resend in <span className="font-mono text-slate-400">{countdown}s</span></p>
                        ) : (
                          <button type="button" onClick={resendOtp} disabled={loading}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                            <RotateCcw size={11} /> Resend OTP
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                </motion.div>
              )}

              {/* ── Email tab ── */}
              {tab === 'email' && (
                <motion.div key="email" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-3 transition focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/20">
                        <Mail size={15} className="shrink-0 text-slate-500" />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@email.com"
                          className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
                          style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Password</label>
                        <Link href="/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300 transition">
                          Forgot password?
                        </Link>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-3 transition focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/20">
                        <Lock size={15} className="shrink-0 text-slate-500" />
                        <input type={showPassword ? 'text' : 'password'} required value={password}
                          onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
                          className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
                          style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }} />
                        <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-slate-600 hover:text-slate-400">
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-bold text-white shadow-neon-emerald transition hover:opacity-90 disabled:opacity-50">
                      {loading
                        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        : <>Sign In <ArrowRight size={15} /></>}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="mt-5 space-y-2 border-t border-white/8 pt-5 text-center text-sm">
              <p className="text-slate-500">
                New here?{' '}
                <Link href="/user/signup" className="font-semibold text-emerald-400 hover:text-emerald-300 transition">
                  Create account →
                </Link>
              </p>
              <p className="text-slate-600">
                Business owner?{' '}
                <Link href="/login" className="text-slate-500 hover:text-slate-300 transition">Business login</Link>
              </p>
            </div>
          </div>
        </div>
      <p className="mt-4 text-center text-xs text-slate-700">Protected by Supabase Auth · End-to-end encrypted</p>
      </div>
    </main>
  );
}

export default function UserLoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-violet-500" />
      </main>
    }>
      <UserLoginContent />
    </Suspense>
  );
}
