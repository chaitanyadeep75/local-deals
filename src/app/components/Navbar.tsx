'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import {
  Store,
  LogIn,
  Home,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';

export default function Navbar() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setLoggedIn(!!data.session);
      setLoading(false);
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setLoggedIn(!!session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return null;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b shadow-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* LOGO */}
        <Link
          href="/"
          className="flex items-center gap-2 font-extrabold text-lg tracking-tight"
        >
          <div className="bg-black text-white p-2 rounded-xl shadow">
            <Store size={20} />
          </div>
          <span>
            Local<span className="text-green-600">Deals</span>
          </span>
        </Link>

        {/* NAV ACTIONS */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* HOME */}
          <Link
            href="/"
            className="hidden md:flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Home size={18} />
            Home
          </Link>

          {!loggedIn && (
            <>
              {/* BUSINESS SIGNUP */}
              <Link
                href="/signup"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white font-semibold shadow hover:shadow-lg transition"
              >
                <Store size={18} />
                <span className="hidden sm:inline">Business</span>
              </Link>

              {/* LOGIN */}
              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 font-semibold hover:bg-gray-100 transition"
              >
                <LogIn size={18} />
                <span className="hidden sm:inline">Login</span>
              </Link>
            </>
          )}

          {loggedIn && (
            <>
              {/* DASHBOARD */}
              <Link
                href="/business/dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white font-semibold shadow hover:shadow-lg transition"
              >
                <LayoutDashboard size={18} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>

              {/* LOGOUT */}
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/';
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white font-semibold shadow hover:shadow-lg transition"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
