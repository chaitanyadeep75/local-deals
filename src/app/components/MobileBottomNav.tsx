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
    ? { href: '/user/profile', label: 'Saved', Icon: Bookmark }
    : { href: '/user/login', label: 'Login', Icon: UserCircle2 };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] bg-slate-950/96 backdrop-blur-3xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 pt-1.5 pb-2">

        {/* ── Home ── */}
        <NavTab href="/" label="Home" icon={Home} active={isActive('/')} />

        {/* ── Map — gradient pill, always stands out ── */}
        <Link
          href="/map"
          onClick={() => void trackEvent('mobile_nav_click', { href: '/map', label: 'Map' })}
          className="flex flex-1 flex-col items-center gap-1 py-1 select-none active:opacity-60 transition-opacity duration-75"
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-[16px] transition-all duration-200 ${
              isActive('/map')
                ? 'bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-[0_4px_20px_rgba(139,92,246,0.65)] scale-110'
                : 'bg-gradient-to-br from-violet-600/80 to-fuchsia-600/80 shadow-[0_2px_14px_rgba(139,92,246,0.35)]'
            }`}
          >
            <MapPinned size={22} className="text-white" />
          </div>
          <span
            className={`text-[10px] font-bold transition-colors duration-200 ${
              isActive('/map') ? 'text-violet-400' : 'text-slate-400'
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
            if (!user) { router.push('/login'); return; }
            await supabase.auth.signOut();
            localStorage.removeItem('ld_role_hint');
            void trackEvent('mobile_logout', { source: 'mobile_bottom_nav' });
            router.push('/');
          }}
          className="flex flex-1 flex-col items-center gap-1 py-1 select-none active:opacity-60 transition-opacity duration-75"
        >
          {user ? (
            <>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-[14px] text-[13px] font-extrabold text-white shadow-md transition-all duration-200 ${
                  isBusiness
                    ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_2px_10px_rgba(139,92,246,0.45)]'
                    : 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-[0_2px_10px_rgba(52,211,153,0.35)]'
                }`}
              >
                {initial}
              </div>
              <span className="text-[10px] font-bold text-slate-500">Logout</span>
            </>
          ) : (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-white/10 bg-white/5">
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
      className="flex flex-1 flex-col items-center gap-1 py-1 select-none active:opacity-60 transition-opacity duration-75"
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-[14px] transition-all duration-200 ${
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
