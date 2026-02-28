'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  Home,
  LayoutDashboard,
  UserCircle2,
  LogOut,
  Bookmark,
  MapPinned,
} from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import { trackEvent } from '@/app/lib/analytics';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isBusiness, setIsBusiness] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUser(data.user);
      setIsBusiness(data.user.user_metadata?.role === 'business');
    };
    init();
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setIsBusiness(session?.user?.user_metadata?.role === 'business');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const navItem = (
    href: string,
    label: string,
    Icon: ComponentType<{ size?: number }>
  ) => {
    const active = pathname === href || pathname?.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        onClick={() => { void trackEvent('mobile_nav_click', { href, label }); }}
        className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition ${
          active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'
        }`}
      >
        <Icon size={20} />
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/80 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 items-end gap-1 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
        {navItem('/', 'Home', Home)}
        {navItem('/map', 'Map', MapPinned)}
        {user && isBusiness && navItem('/business/dashboard', 'Dash', LayoutDashboard)}
        {user && !isBusiness && navItem('/user/profile', 'Saved', Bookmark)}
        {!user && navItem('/user/login', 'Login', UserCircle2)}

        <button
          onClick={async () => {
            if (!user) {
              void trackEvent('mobile_nav_click', { href: '/signup', label: 'Sign up' });
              router.push('/signup');
              return;
            }
            await supabase.auth.signOut();
            localStorage.removeItem('ld_role_hint');
            void trackEvent('mobile_logout', { source: 'mobile_bottom_nav' });
            router.push('/');
          }}
          className="flex flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium text-slate-400 transition"
          aria-label="Logout or signup"
        >
          <LogOut size={20} />
          {user ? 'Logout' : 'Sign up'}
        </button>
      </div>
    </nav>
  );
}
