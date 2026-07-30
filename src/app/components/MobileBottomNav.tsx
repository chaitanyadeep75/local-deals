'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  Home,
  LayoutDashboard,
  Bookmark,
  MapPinned,
  Shield,
  UserCircle2,
} from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import { trackEvent } from '@/app/lib/analytics';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isBusiness, setIsBusiness] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUser(data.user);
      setIsBusiness(data.user.user_metadata?.role === 'business');
      if (data.user.user_metadata?.role === 'admin') setIsAdmin(true);
      else {
        const row = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', data.user.id)
          .maybeSingle();
        setIsAdmin(!!row.data);
      }
    };
    init();
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setIsBusiness(session?.user?.user_metadata?.role === 'business');
      setIsAdmin(session?.user?.user_metadata?.role === 'admin');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const initial = (
    user?.user_metadata?.full_name?.[0] ||
    user?.email?.[0] ||
    '?'
  ).toUpperCase();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : !!pathname?.startsWith(href);

  // slot 3 is context-sensitive
  const slot3 = isAdmin
    ? { href: '/admin', label: 'Admin', Icon: Shield }
    : isBusiness
    ? { href: '/business/dashboard', label: 'Dash', Icon: LayoutDashboard }
    : user
    ? { href: '/saved', label: 'Saved', Icon: Bookmark }
    : { href: '/user/login', label: 'Login', Icon: UserCircle2 };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] bg-slate-950/96 backdrop-blur-3xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 pt-1.5 pb-2">

        {/* ── Home ── */}
        <NavTab href="/" label="Home" icon={Home} active={isActive('/')} />

        {/* ── Map — gradient reserved for the active state ── */}
        <Link
          href="/map"
          onClick={() => void trackEvent('mobile_nav_click', { href: '/map', label: 'Map' })}
          className="flex flex-1 flex-col items-center gap-1 py-1 select-none active:opacity-60 transition-opacity duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded-xl"
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 ${
              isActive('/map')
                ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-neon-violet scale-110'
                : 'border border-white/10 bg-slate-800/80'
            }`}
          >
            <MapPinned size={22} className={isActive('/map') ? 'text-white' : 'text-violet-400'} />
          </div>
          <span
            className={`text-[10px] font-bold transition-colors duration-200 ${
              isActive('/map') ? 'text-violet-400' : 'text-slate-500'
            }`}
          >
            Map
          </span>
        </Link>

        {/* ── Slot 3 ── */}
        <NavTab
          href={slot3.href}
          label={slot3.label}
          icon={slot3.Icon}
          active={isActive(slot3.href)}
        />

        {/* ── Me / Account ── */}
        <button
          onClick={async () => {
            if (!user) { router.push('/user/signup'); return; }
            await supabase.auth.signOut();
            localStorage.removeItem('ld_role_hint');
            void trackEvent('mobile_logout', { source: 'mobile_bottom_nav' });
            router.push('/');
          }}
          aria-label={user ? 'Sign out' : 'Sign up'}
          className="flex flex-1 flex-col items-center gap-1 py-1 select-none active:opacity-60 transition-opacity duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded-xl"
        >
          {user ? (
            <>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-2xl border text-[13px] font-extrabold transition-all duration-200 ${
                  isBusiness
                    ? 'border-violet-500/30 bg-violet-500/15 text-violet-300'
                    : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                }`}
              >
                {initial}
              </div>
              <span className="text-[10px] font-bold text-slate-500">Logout</span>
            </>
          ) : (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-slate-800/80">
                <UserCircle2 size={20} className="text-slate-500" />
              </div>
              <span className="text-[10px] font-bold text-slate-500">Sign Up</span>
            </>
          )}
        </button>

      </div>
    </nav>
  );
}

function NavTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={() => void trackEvent('mobile_nav_click', { href, label })}
      className="flex flex-1 flex-col items-center gap-1 py-1 select-none active:opacity-60 transition-opacity duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded-xl"
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-200 ${
          active ? 'bg-violet-500/20 scale-110' : 'scale-100'
        }`}
      >
        <Icon
          size={21}
          className={`transition-colors duration-200 ${
            active ? 'text-violet-400' : 'text-slate-500'
          }`}
        />
      </div>
      <span
        className={`text-[10px] font-bold transition-colors duration-200 ${
          active ? 'text-violet-400' : 'text-slate-500'
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
