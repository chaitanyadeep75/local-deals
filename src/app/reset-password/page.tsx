'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

function ResetContent() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => router.push('/user/login'), 2500);
  };

  const strength = getStrength(password);

  if (!ready) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-violet-500" />
        <p className="text-sm text-slate-500">Verifying reset link…</p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {done ? (
        <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20">
            <CheckCircle2 size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-lg font-extrabold text-white">Password updated!</h2>
          <p className="mt-2 text-sm text-slate-500">Redirecting you to login…</p>
          <div className="mt-3 flex justify-center gap-1">
            {[0,1,2].map((i) => (
              <div key={i} className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-neon-violet">
              <KeyRound size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-extrabold text-white">Set new password</h1>
            <p className="mt-1 text-sm text-slate-500">Choose a strong password</p>
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
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">New Password</label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-3 transition focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20">
                <Lock size={15} className="shrink-0 text-slate-500" />
                <input type={showPw ? 'text' : 'password'} required value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters"
                  className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
                  style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }} />
                <button type="button" onClick={() => setShowPw((p) => !p)} className="text-slate-600 hover:text-slate-400">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength ? STRENGTH_COLOR[strength] : 'bg-white/10'}`} />
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={10} className={STRENGTH_TEXT[strength]} />
                    <span className={`text-[11px] font-medium ${STRENGTH_TEXT[strength]}`}>{STRENGTH_LABEL[strength]} password</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Confirm Password</label>
              <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition
                ${confirm && confirm !== password
                  ? 'border-rose-500/40 bg-rose-500/5'
                  : 'border-white/10 bg-slate-800/80 focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20'}`}>
                <Lock size={15} className="shrink-0 text-slate-500" />
                <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
                  style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }} />
                {confirm && confirm === password && (
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                )}
              </div>
              {confirm && confirm !== password && (
                <p className="mt-1 text-xs text-rose-400">Passwords don&apos;t match</p>
              )}
            </div>

            <button type="submit" disabled={loading || (!!confirm && password !== confirm)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90 disabled:opacity-50 mt-1">
              {loading
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                : 'Update Password'}
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/15 blur-[90px]" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-fuchsia-600/10 blur-[60px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-[0_24px_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-600" />
          <div className="p-7">
            <Suspense fallback={
              <div className="py-8 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-violet-500" />
              </div>
            }>
              <ResetContent />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
