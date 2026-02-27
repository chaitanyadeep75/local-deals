'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function UserSignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
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
          full_name: name,
          role: 'user', // distinguish from business accounts
        },
      },
    });

    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-4 shadow-lg">
              <Sparkles className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-500 mt-1 text-sm">Save deals, write reviews, get notified</p>
          </div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">You're in!</h2>
              <p className="text-gray-500 text-sm mb-6">
                Check your email to verify your account, then log in.
              </p>
              <Link
                href="/user/login"
                className="inline-block bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-600 transition"
              >
                Go to Login →
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                  Full Name
                </label>
                <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition">
                  <User size={16} className="text-gray-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Chaitanya Deep"
                    className="flex-1 outline-none text-sm bg-transparent"
                    style={{ border: 'none', padding: 0, boxShadow: 'none' }}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                  Email
                </label>
                <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition">
                  <Mail size={16} className="text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="flex-1 outline-none text-sm bg-transparent"
                    style={{ border: 'none', padding: 0, boxShadow: 'none' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
                  Password
                </label>
                <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-3.5 py-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition">
                  <Lock size={16} className="text-gray-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="flex-1 outline-none text-sm bg-transparent"
                    style={{ border: 'none', padding: 0, boxShadow: 'none' }}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                  {error}
                </p>
              )}

              <button
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3.5 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-60 mt-2"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Footer links */}
          {!success && (
            <div className="mt-6 space-y-3 text-center text-sm text-gray-500">
              <p>
                Already have an account?{' '}
                <Link href="/user/login" className="text-emerald-600 font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
              <p>
                Are you a business?{' '}
                <Link href="/signup" className="text-purple-600 font-semibold hover:underline">
                  Business signup →
                </Link>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}