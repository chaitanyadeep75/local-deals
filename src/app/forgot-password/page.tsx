'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email address.'); return; }
    setLoading(true); setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  };

  return (
    <main className="relative flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/15 blur-[90px]" />
        <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-indigo-600/10 blur-[60px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-[0_24px_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-600" />

          <div className="p-7">
            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div key="sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="py-4 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20">
                    <CheckCircle2 size={28} className="text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-extrabold text-white">Check your inbox</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    We sent a reset link to<br />
                    <span className="font-semibold text-white">{email}</span>
                  </p>
                  <p className="mt-3 text-xs text-slate-600">
                    Didn&apos;t get it? Check spam or{' '}
                    <button onClick={() => setSent(false)} className="text-violet-400 underline hover:text-violet-300">
                      try again
                    </button>
                  </p>
                  <Link href="/user/login"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
                    <ArrowLeft size={14} /> Back to Login
                  </Link>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mb-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-neon-violet">
                      <KeyRound size={20} className="text-white" />
                    </div>
                    <h1 className="text-xl font-extrabold text-white">Forgot password?</h1>
                    <p className="mt-1 text-sm text-slate-500">Enter your email to get a reset link</p>
                  </div>

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

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Email Address
                      </label>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-3 transition focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20">
                        <Mail size={15} className="shrink-0 text-slate-500" />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@email.com"
                          className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
                          style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }} />
                      </div>
                    </div>

                    <button type="submit" disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90 disabled:opacity-50">
                      {loading
                        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        : 'Send Reset Link'}
                    </button>
                  </form>

                  <div className="mt-5 border-t border-white/8 pt-5 text-center">
                    <Link href="/user/login"
                      className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-300">
                      <ArrowLeft size={13} /> Back to Login
                    </Link>
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
