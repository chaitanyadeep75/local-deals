'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { User, Mail, LogOut, LayoutDashboard, Bookmark, Sparkles, MapPinned, House, Shield, Zap, ChevronDown } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isBusiness, setIsBusiness] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
        const role = data.user.user_metadata?.role;
        if (role === 'admin') {
          setIsAdmin(true);
        } else {
          const adminRow = await supabase.from('admin_users').select('user_id').eq('user_id', data.user.id).maybeSingle();
          setIsAdmin(!!adminRow.data);
        }
      }
    };
    checkUser();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsBusiness(await detectIsBusiness(session.user));
        const role = session.user.user_metadata?.role;
        if (role === 'admin') {
          setIsAdmin(true);
        } else {
          const adminRow = await supabase.from('admin_users').select('user_id').eq('user_id', session.user.id).maybeSingle();
          setIsAdmin(!!adminRow.data);
        }
      } else {
        setIsBusiness(false);
        setIsAdmin(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  const NavLink = ({ href, icon: Icon, label, active }: { href: string; icon: React.ComponentType<{size?: number}>; label: string; active: boolean }) => (
    <Link
      href={href}
      className={`hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 md:inline-flex ${
        active
          ? 'bg-white/10 text-white shadow-inner-top'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      <Icon size={14} />
      {label}
    </Link>
  );

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-white/8 bg-slate-950/90 shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl'
          : 'border-b border-white/5 bg-slate-950/75 backdrop-blur-xl'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 md:px-6">

        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-neon-violet transition-all duration-300 group-hover:shadow-[0_0_28px_rgba(139,92,246,0.7)]">
            <Zap size={15} className="text-white" fill="white" />
          </div>
          <span className="text-gradient-brand text-xl font-extrabold tracking-tight md:text-2xl">
            LocalDeals
          </span>
          <span
            className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider md:inline-flex ${
              isMap
                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                : 'border-violet-500/30 bg-violet-500/10 text-violet-400'
            }`}
          >
            {isMap ? <MapPinned size={9} /> : <Sparkles size={9} />}
            {isMap ? 'Map' : 'Live'}
          </span>
        </Link>

        {/* Nav links */}
        <div className="relative flex items-center gap-1 md:gap-1.5">
          <NavLink href="/" icon={House} label="Home" active={isHome} />
          <NavLink href="/map" icon={MapPinned} label="Map" active={isMap} />

          {user && showBusinessNav && (
            <NavLink href="/business/dashboard" icon={LayoutDashboard} label="Dashboard" active={isDash} />
          )}
          {user && isAdmin && (
            <NavLink href="/admin" icon={Shield} label="Admin" active={!!pathname?.startsWith('/admin')} />
          )}
          {user && !showBusinessNav && (
            <NavLink href="/user/profile" icon={Bookmark} label="Saved" active={isSaved} />
          )}

          {/* Auth section */}
          {!user ? (
            <div className="flex items-center gap-2 ml-1">
              <Link
                href="/user/login"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all duration-200 hover:bg-white/10 hover:text-white md:px-4 md:py-2 md:text-sm"
              >
                Sign In
              </Link>
              <Link
                href="/login"
                className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white shadow-neon-violet transition-all duration-200 hover:opacity-90 hover:shadow-[0_0_28px_rgba(139,92,246,0.6)] md:px-4 md:py-2 md:text-sm"
              >
                Business
              </Link>
            </div>
          ) : (
            <>
              <button
                onClick={handleLogout}
                className="ml-1 hidden rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-400 transition-all duration-200 hover:bg-rose-500/20 hover:text-rose-300 md:block"
              >
                Logout
              </button>

              {/* Profile dropdown */}
              <div ref={dropdownRef} className="relative ml-1">
                <button
                  onClick={() => setOpen(!open)}
                  className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-all duration-200 ${
                    open
                      ? 'border-violet-500/40 bg-violet-500/15'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white ${
                      showBusinessNav
                        ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600'
                        : 'bg-gradient-to-br from-emerald-400 to-teal-500'
                    }`}
                  >
                    {displayName.charAt(0).toUpperCase() || <User size={14} />}
                  </div>
                  <ChevronDown
                    size={13}
                    className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                  />
                </button>

                {open && (
                  <div className="absolute right-0 top-14 w-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                    {/* Header */}
                    <div className="mb-1 rounded-xl bg-gradient-to-r from-violet-600/20 via-fuchsia-600/10 to-indigo-600/20 p-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg ${
                            showBusinessNav
                              ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-neon-violet'
                              : 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-neon-emerald'
                          }`}
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{displayName}</p>
                          <p className="flex items-center gap-1 truncate text-xs text-slate-400">
                            <Mail size={10} /> {user.email}
                          </p>
                        </div>
                        <span
                          className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            isAdmin
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : showBusinessNav
                              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isAdmin ? '🛡 Admin' : showBusinessNav ? '🏪 Business' : '👤 User'}
                        </span>
                      </div>
                    </div>

                    {/* Links */}
                    {showBusinessNav ? (
                      <Link
                        href="/business/dashboard"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition-all duration-150 hover:bg-white/8 hover:text-white"
                      >
                        <LayoutDashboard size={15} className="text-violet-400" />
                        My Dashboard
                      </Link>
                    ) : (
                      <Link
                        href="/user/profile"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition-all duration-150 hover:bg-white/8 hover:text-white"
                      >
                        <Bookmark size={15} className="text-emerald-400" />
                        My Saved Deals
                      </Link>
                    )}
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition-all duration-150 hover:bg-white/8 hover:text-white"
                      >
                        <Shield size={15} className="text-rose-400" />
                        Admin Console
                      </Link>
                    )}

                    <div className="my-1 h-px bg-white/8" />

                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-400 transition-all duration-150 hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <LogOut size={14} />
                      Sign Out
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
