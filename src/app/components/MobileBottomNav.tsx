'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  LayoutDashboard,
  PlusCircle,
  LogOut,
} from 'lucide-react';
import { supabase } from '@/app/lib/supabase';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItem = (
    href: string,
    label: string,
    Icon: any
  ) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`flex flex-col items-center gap-1 text-xs
        ${active ? 'text-black' : 'text-gray-400'}`}
      >
        <Icon size={22} />
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg md:hidden z-50">
      <div className="flex justify-around py-2">
        {navItem('/', 'Home', Home)}
        {navItem('/business/dashboard', 'Dashboard', LayoutDashboard)}

        {/* ADD DEAL (CTA) */}
        <button
          onClick={() => router.push('/business/dashboard')}
          className="relative -top-6 bg-black text-white p-4 rounded-full shadow-xl"
        >
          <PlusCircle size={26} />
        </button>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace('/');
          }}
          className="flex flex-col items-center gap-1 text-xs text-gray-400"
        >
          <LogOut size={22} />
          Logout
        </button>
      </div>
    </nav>
  );
}
