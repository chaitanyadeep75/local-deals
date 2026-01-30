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

    // Listen to auth changes (login / logout)
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setLoggedIn(!!session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // ⛔ Prevent navbar flicker / wrong state
  if (loading) return null;

  return (
    <nav className="w-full bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* LOGO */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg"
        >
          <Store size={22} />
          LocalDeals
        </Link>

        {/* NAV LINKS */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-gray-700 hover:text-black"
          >
            <Home size={18} /> Home
          </Link>

          {!loggedIn && (
            <>
              <Link
                href="/signup"
                className="flex items-center gap-1 text-gray-700 hover:text-black"
              >
                <Store size={18} /> Business Signup
              </Link>

              <Link
                href="/login"
                className="flex items-center gap-1 bg-black text-white px-3 py-2 rounded"
              >
                <LogIn size={18} /> Login
              </Link>
            </>
          )}

          {loggedIn && (
            <>
              <Link
                href="/business/dashboard"
                className="flex items-center gap-1 text-gray-700 hover:text-black"
              >
                <LayoutDashboard size={18} /> Dashboard
              </Link>

              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/';
                }}
                className="flex items-center gap-1 bg-red-500 text-white px-3 py-2 rounded"
              >
                <LogOut size={18} /> Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
