'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Mail, Lock, UserPlus } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess('Account created! Please check your email to verify.');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black px-4">
      {/* CARD */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-8 md:p-10">
        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-black flex items-center justify-center">
            <Store size={26} className="text-white" />
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">
            Business Signup
          </h1>

          <p className="text-gray-500 mt-1">
            Start posting deals & attract customers
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSignup} className="space-y-5">
          {/* EMAIL */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Business Email
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
                placeholder="Minimum 6 characters"
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

          {/* SUCCESS */}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          {/* BUTTON */}
          <button
            disabled={loading}
            className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:scale-[1.02] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <UserPlus size={18} />
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        {/* FOOTER */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-black hover:underline"
          >
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
