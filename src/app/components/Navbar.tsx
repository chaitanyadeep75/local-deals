'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { User, Mail, LogOut, LayoutDashboard, Bookmark } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';

export default function Navbar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isBusiness, setIsBusiness] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        // Check if business: has no 'role: user' metadata OR has a deal in the DB
        const role = data.user.user_metadata?.role;
        setIsBusiness(role !== 'user');
      }
    };
    checkUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const role = session.user.user_metadata?.role;
        setIsBusiness(role !== 'user');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const displayName = user?.user_metadata?.full_name
    || (user?.email?.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))
    || '';

  return (
    <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        <Link href="/">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-indigo-600 bg-clip-text text-transparent">
            LocalDeals ✨
          </h1>
        </Link>

        <div className="flex items-center gap-3 relative">
          <Link href="/" className="px-3 py-2 rounded-full hover:bg-gray-100 text-sm font-medium">
            Home
          </Link>

          {/* Business nav */}
          {user && isBusiness && (
            <Link href="/business/dashboard"
              className="px-3 py-2 rounded-full hover:bg-gray-100 text-sm font-medium flex items-center gap-1.5">
              <LayoutDashboard size={15} />
              Dashboard
            </Link>
          )}

          {/* User nav */}
          {user && !isBusiness && (
            <Link href="/user/profile"
              className="px-3 py-2 rounded-full hover:bg-gray-100 text-sm font-medium flex items-center gap-1.5">
              <Bookmark size={15} />
              Saved
            </Link>
          )}

          {/* Auth buttons */}
          {!user ? (
            <div className="flex items-center gap-2">
              <Link href="/user/login"
                className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium hover:bg-gray-50 transition">
                Sign In
              </Link>
              <Link href="/login"
                className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition">
                Business
              </Link>
            </div>
          ) : (
            <>
              <button onClick={handleLogout}
                className="hidden md:block px-4 py-2 rounded-full bg-red-500 text-white text-sm hover:bg-red-600 transition">
                Logout
              </button>

              {/* Profile dropdown */}
              <div ref={dropdownRef} className="relative">
                <button onClick={() => setOpen(!open)}
                  className={`w-10 h-10 flex items-center justify-center rounded-full text-white shadow-md font-bold transition hover:scale-105
                    ${isBusiness
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                      : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                    }`}
                >
                  {displayName.charAt(0).toUpperCase() || <User size={18} />}
                </button>

                {open && (
                  <div className="absolute right-0 top-14 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 z-50">
                    {/* Role badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                        ${isBusiness ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isBusiness ? '🏪 Business' : '👤 User'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0
                        ${isBusiness ? 'bg-gradient-to-br from-purple-500 to-indigo-500' : 'bg-gradient-to-br from-emerald-400 to-teal-500'}`}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{displayName}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                          <Mail size={11} /> {user.email}
                        </p>
                      </div>
                    </div>

                    {isBusiness ? (
                      <Link href="/business/dashboard" onClick={() => setOpen(false)}
                        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition mb-2">
                        <LayoutDashboard size={15} className="text-purple-500" />
                        My Dashboard
                      </Link>
                    ) : (
                      <Link href="/user/profile" onClick={() => setOpen(false)}
                        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition mb-2">
                        <Bookmark size={15} className="text-emerald-500" />
                        My Profile & Saved Deals
                      </Link>
                    )}

                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2 bg-red-50 text-red-600 py-2.5 px-3 rounded-xl text-sm font-medium hover:bg-red-100 transition">
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}