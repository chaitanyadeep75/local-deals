'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, LayoutDashboard, LogOut } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // initial session
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });

    // listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navItem = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-4 py-2 rounded-lg ${
        pathname === href ? 'bg-black text-white' : 'text-gray-700'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">LocalDeals</Link>

        <nav className="flex items-center gap-2">
          {navItem('/', 'Home')}

          {isLoggedIn ? (
            <>
              {navItem('/business/dashboard', 'Dashboard')}
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="bg-black text-white px-4 py-2 rounded-lg"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
