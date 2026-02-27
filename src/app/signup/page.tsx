'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { Mail, Lock, Store, UserPlus } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'business',
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-black flex items-center justify-center mb-4">
            <Store className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold">
            Business Signup
          </h1>
          <p className="text-gray-500 mt-1">
            Start listing your deals today
          </p>
        </div>

        {success ? (
          <div className="text-center text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-4">
            Account created!  
            <br />
            Please verify your email before logging in.
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Business Email
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
                  placeholder="Minimum 6 characters"
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
              className="w-full bg-black text-white py-4 rounded-xl font-bold hover:scale-[1.02] transition flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-black">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
