'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, Mail, Lock } from 'lucide-react';

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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/business/dashboard');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black px-4">
      {/* CARD */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-8 md:p-10">
        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-black flex items-center justify-center">
            <LogIn size={26} className="text-white" />
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
            Business Login
          </h1>

          <p className="text-gray-500 mt-1">
            Manage your deals & grow faster
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* EMAIL */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Email
            </label>
            <div className="mt-1 flex items-center gap-2 border rounded-xl px-3 py-3 focus-within:ring-2 focus-within:ring-black">
              <Mail size={18} className="text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="business@email.com"
                className="w-full outline-none text-gray-900"
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="mt-1 flex items-center gap-2 border rounded-xl px-3 py-3 focus-within:ring-2 focus-within:ring-black">
              <Lock size={18} className="text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full outline-none text-gray-900"
              />
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* BUTTON */}
          <button
            disabled={loading}
            className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:scale-[1.02] transition disabled:opacity-60"
          >
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>

        {/* FOOTER */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Don’t have an account?{' '}
          <Link
            href="/signup"
            className="font-semibold text-black hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
