'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, LogIn } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-black flex items-center justify-center mb-4">
            <LogIn className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold">Business Login</h1>
          <p className="text-gray-500 mt-1">
            Manage deals & grow your business
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Email
            </label>
            <div className="mt-1 flex items-center gap-2 border rounded-xl px-3 py-3">
              <Mail size={18} className="text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full outline-none"
                placeholder="business@email.com"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="mt-1 flex items-center gap-2 border rounded-xl px-3 py-3">
              <Lock size={18} className="text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            disabled={loading}
            className="w-full bg-black text-white py-4 rounded-xl font-bold hover:scale-[1.02] transition"
          >
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Don’t have an account?{' '}
          <Link href="/signup" className="font-semibold text-black">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
