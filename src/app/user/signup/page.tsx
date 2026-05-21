'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { Mail, Lock, User, Zap, AlertCircle, Eye, EyeOff, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

function getStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
const STRENGTH_COLOR = ['', 'bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-emerald-500'] as const;
const STRENGTH_TEXT  = ['', 'text-red-400', 'text-amber-400', 'text-yellow-400', 'text-emerald-400'] as const;
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

export default function UserSignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim(), role: 'user' } },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess(true);
  };

  return (
    <main className="relative min-h-screen px-4 pb-28 pt-8">
      {/* Blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-600/15 blur-[90px]" />
        <div className="absolute bottom-1/3 left-1/4 h-48 w-48 rounded-full bg-violet-600/10 blur-[60px]" />
      </div>

      <div className="relative w-full">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-violet-500" />

          <div className="p-7">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-6 text-center"
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30 shadow-neon-emerald">
                    <CheckCircle2 size={28} className="text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-extrabold text-white">You&apos;re in!</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Check your email to verify your account, then sign in.
                  </p>
                  <Link
                    href="/user/login"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-bold text-white shadow-neon-emerald hover:opacity-90 transition"
                  >
                    Go to Sign In <ArrowRight size={15} />
                  </Link>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {/* Header */}
                  <div className="mb-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-neon-emerald">
                      <Zap size={20} className="text-white" fill="white" />
                    </div>
                    <h1 className="text-xl font-extrabold text-white">Create account</h1>
                    <p className="mt-1 text-sm text-slate-500">Save deals, write reviews, get notified</p>
                  </div>

                  {/* Google */}
                  <button
                    onClick={handleGoogle}
                    disabled={googleLoading || loading}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 hover:border-white/20 disabled:opacity-50"
                  >
                    {googleLoading
                      ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      : <GoogleIcon />
                    }
                    Sign up with Google
                  </button>

                  {/* Divider */}
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/8" />
                    <span className="text-xs font-medium text-slate-600">or with email</span>
                    <div className="h-px flex-1 bg-white/8" />
                  </div>

                  {/* Error */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-400"
                      >
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Form */}
                  <form onSubmit={handleSignup} className="space-y-3.5">
                    {/* Name */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Full Name</label>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-3 transition focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/20">
                        <User size={15} className="shrink-0 text-slate-500" />
                        <input
                          type="text" required value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
                          style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-3 transition focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/20">
                        <Mail size={15} className="shrink-0 text-slate-500" />
                        <input
                          type="email" required value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@email.com"
                          className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
                          style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Password</label>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-3 transition focus-within:border-emerald-500/40 focus-within:ring-2 focus-within:ring-emerald-500/20">
                        <Lock size={15} className="shrink-0 text-slate-500" />
                        <input
                          type={showPassword ? 'text' : 'password'} required value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
                          style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }}
                        />
                        <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-slate-600 hover:text-slate-400">
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {/* Strength meter */}
                      {password && (() => {
                        const s = getStrength(password);
                        return (
                          <div className="mt-2 space-y-1">
                            <div className="flex gap-1">
                              {[1,2,3,4].map((i) => (
                                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= s ? STRENGTH_COLOR[s] : 'bg-white/10'}`} />
                              ))}
                            </div>
                            <div className="flex items-center gap-1">
                              <ShieldCheck size={10} className={STRENGTH_TEXT[s]} />
                              <span className={`text-[11px] font-medium ${STRENGTH_TEXT[s]}`}>{STRENGTH_LABEL[s]} password</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-bold text-white shadow-neon-emerald transition hover:opacity-90 disabled:opacity-50 mt-1"
                    >
                      {loading
                        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        : <>Create Account <ArrowRight size={15} /></>
                      }
                    </button>
                  </form>

                  {/* Footer */}
                  <div className="mt-5 space-y-2 border-t border-white/8 pt-5 text-center text-sm">
                    <p className="text-slate-500">
                      Already have an account?{' '}
                      <Link href="/user/login" className="font-semibold text-emerald-400 hover:text-emerald-300 transition">Sign in →</Link>
                    </p>
                    <p className="text-slate-600">
                      Business owner?{' '}
                      <Link href="/signup" className="text-slate-500 hover:text-slate-300 transition">Business signup</Link>
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}
