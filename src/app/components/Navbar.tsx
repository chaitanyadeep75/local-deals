'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { User, Mail, LogOut, LayoutDashboard, Bookmark, Sparkles, MapPinned, House } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isBusiness, setIsBusiness] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const detectIsBusiness = async (nextUser: SupabaseUser) => {
      const role = nextUser?.user_metadata?.role;
      if (role === 'business') return true;
      if (role === 'user') return false;
      const hint = typeof window !== 'undefined' ? localStorage.getItem('ld_role_hint') : null;
      if (hint === 'business') return true;
      if (hint === 'user') return false;
      const { count } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', nextUser.id);
      return (count || 0) > 0;
    };

    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        setIsBusiness(await detectIsBusiness(data.user));
      }
    };
    checkUser();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsBusiness(await detectIsBusiness(session.user));
      } else {
        setIsBusiness(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('ld_role_hint');
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
  const isBusinessView = pathname?.startsWith('/business');
  const showBusinessNav = isBusiness || isBusinessView;
  const isHome = pathname === '/';
  const isMap = pathname?.startsWith('/map');
  const isSaved = pathname?.startsWith('/user/profile');
  const isDash = pathname?.startsWith('/business/dashboard');
  const linkBase = 'rounded-full px-3 py-2 text-sm font-medium transition';

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-xl ${isMap ? 'border-b border-white/60 bg-white/80 shadow-sm' : 'border-b border-indigo-100 bg-white/85'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 md:px-6 md:py-3">

        <Link href="/">
          <div className="flex items-center gap-2">
            <h1 className="bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent md:text-2xl">
              LocalDeals
            </h1>
            <span className={`hidden items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium md:inline-flex ${isMap ? 'bg-slate-900 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
              {isMap ? <MapPinned size={11} /> : <Sparkles size={11} />}
              {isMap ? 'Map mode' : 'Fresh nearby'}
            </span>
          </div>
        </Link>

        <div className="relative flex items-center gap-2 md:gap-3">
          <Link href="/" className={`${linkBase} hidden items-center gap-1.5 md:inline-flex ${isHome ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <House size={15} />
            Home
          </Link>

          <Link href="/map" className={`${linkBase} hidden items-center gap-1.5 md:inline-flex ${isMap ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <MapPinned size={15} />
            Map
          </Link>

          {/* Business nav */}
          {user && showBusinessNav && (
            <Link href="/business/dashboard"
              className={`${linkBase} hidden items-center gap-1.5 md:flex ${isDash ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <LayoutDashboard size={15} />
              Dashboard
            </Link>
          )}

          {/* User nav */}
          {user && !showBusinessNav && (
              <Link href="/user/profile"
                className={`${linkBase} hidden items-center gap-1.5 md:flex ${isSaved ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Bookmark size={15} />
                Saved
            </Link>
          )}

          {/* Auth buttons */}
          {!user ? (
            <div className="flex items-center gap-2">
              <Link href="/user/login"
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 md:px-4 md:py-2 md:text-sm">
                Sign In
              </Link>
              <Link href="/login"
                className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 md:px-4 md:py-2 md:text-sm">
                Business
              </Link>
            </div>
          ) : (
            <>
              <button onClick={handleLogout}
                className="hidden rounded-full bg-red-500 px-4 py-2 text-sm text-white transition hover:bg-red-600 md:block">
                Logout
              </button>

              {/* Profile dropdown */}
              <div ref={dropdownRef} className="relative">
                <button onClick={() => setOpen(!open)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md font-bold transition hover:scale-105
                    ${showBusinessNav
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
                        ${showBusinessNav ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {showBusinessNav ? '🏪 Business' : '👤 User'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0
                        ${showBusinessNav ? 'bg-gradient-to-br from-purple-500 to-indigo-500' : 'bg-gradient-to-br from-emerald-400 to-teal-500'}`}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{displayName}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                          <Mail size={11} /> {user.email}
                        </p>
                      </div>
                    </div>

                    {showBusinessNav ? (
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
