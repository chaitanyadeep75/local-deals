'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, LayoutDashboard, LogOut } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItem = (href: string, label: string, Icon: any) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition
          ${active ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}
        `}
      >
        <Icon size={18} />
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <div className="w-8 h-8 bg-black text-white rounded flex items-center justify-center">
            L
          </div>
          LocalDeals
        </Link>

        <nav className="flex items-center gap-2">
          {navItem('/', 'Home', Home)}
          {navItem('/map', 'Map', Map)}
          {navItem('/business/dashboard', 'Dashboard', LayoutDashboard)}

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg"
          >
            <LogOut size={18} />
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
