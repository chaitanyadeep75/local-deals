'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, AlertCircle, ArrowRight, Eye, EyeOff, Store } from 'lucide-react';
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/business/dashboard`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  const handleLogin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    const role = data.user?.user_metadata?.role;
    if (role === 'user') {
      await supabase.auth.signOut();
      setLoading(false);
      setError('This is a user account. Please use User Login.');
      return;
    }

    setLoading(false);
    localStorage.setItem('ld_role_hint', 'business');
    router.push('/business/dashboard');
  };

  return (
    <main className="relative flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
      {/* Blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/15 blur-[90px]" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-fuchsia-600/10 blur-[60px]" />
        <div className="absolute top-1/4 right-1/4 h-40 w-40 rounded-full bg-indigo-600/10 blur-[60px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-[0_24px_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-600" />

          <div className="p-7">
            {/* Header */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-neon-violet">
                <Store size={20} className="text-white" />
              </div>
              <h1 className="text-xl font-extrabold text-white">Business Login</h1>
              <p className="mt-1 text-sm text-slate-500">Manage your deals &amp; grow your business</p>
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
              Continue with Google
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
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-3 transition focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20">
                  <Mail size={15} className="shrink-0 text-slate-500" />
                  <input
                    type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="business@email.com"
                    className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
                    style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Password</label>
                  <Link href="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 transition">
                    Forgot password?
                  </Link>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-3 transition focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20">
                  <Lock size={15} className="shrink-0 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
                    style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }}
                  />
                  <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-slate-600 hover:text-slate-400">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90 hover:shadow-[0_0_32px_rgba(139,92,246,0.6)] disabled:opacity-50"
              >
                {loading
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  : <>Sign In <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></>
                }
              </button>
            </form>

            {/* Footer */}
            <div className="mt-5 space-y-2 border-t border-white/8 pt-5 text-center text-sm">
              <p className="text-slate-500">
                No account?{' '}
                <Link href="/signup" className="font-semibold text-violet-400 hover:text-violet-300 transition">Create one →</Link>
              </p>
              <p className="text-slate-600">
                Not a business?{' '}
                <Link href="/user/login" className="text-slate-500 hover:text-slate-300 transition">User login</Link>
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-700">
          Protected by Supabase Auth · Your data stays secure
        </p>
      </div>
    </main>
  );
}
