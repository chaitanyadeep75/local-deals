'use client';

import { Suspense, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

function UserLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
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
    if (role === 'business') {
      await supabase.auth.signOut();
      setLoading(false);
      setError('This is a business account. Please use Business Login.');
      return;
    }

    if (role !== 'user') {
      const { count } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', data.user.id);
      if ((count || 0) > 0) {
        await supabase.auth.signOut();
        setLoading(false);
        setError('This is a business account. Please use Business Login.');
        return;
      }
    }

    const next = searchParams.get('next');
    setLoading(false);
    localStorage.setItem('ld_role_hint', 'user');
    router.push(next || '/');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-4 shadow-lg">
              <Sparkles className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500 mt-1 text-sm">Sign in to your LocalDeals account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Email</label>
              <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition">
                <Mail size={16} className="text-gray-400" />
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="flex-1 outline-none text-sm bg-transparent"
                  style={{ border: 'none', padding: 0, boxShadow: 'none' }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Password</label>
              <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition">
                <Lock size={16} className="text-gray-400" />
                <input
                  type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="flex-1 outline-none text-sm bg-transparent"
                  style={{ border: 'none', padding: 0, boxShadow: 'none' }}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{error}</p>
            )}

            <button
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3.5 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-center text-sm text-gray-500">
            <p>
              New here?{' '}
              <Link href="/user/signup" className="text-emerald-600 font-semibold hover:underline">Create account</Link>
            </p>
            <p>
              Business owner?{' '}
              <Link href="/login" className="text-purple-600 font-semibold hover:underline">Business login →</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

export default function UserLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50" />}>
      <UserLoginContent />
    </Suspense>
  );
}
