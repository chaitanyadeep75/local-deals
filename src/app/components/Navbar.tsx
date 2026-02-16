'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ================= CHECK AUTH ================= */
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };

    checkUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  /* ================= LOGOUT ================= */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/login');
  };

  /* ================= CLOSE ON OUTSIDE CLICK ================= */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* BRAND */}
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-indigo-600 bg-clip-text text-transparent">
          LocalDeals ✨
        </h1>

        <div className="flex items-center gap-4 relative">

          <Link href="/" className="px-4 py-2 rounded-full hover:bg-gray-100">
            Home
          </Link>

          {/* SHOW ONLY IF LOGGED IN */}
          {user && (
            <Link
              href="/business/dashboard"
              className="px-4 py-2 rounded-full hover:bg-gray-100"
            >
              Dashboard
            </Link>
          )}

          {/* AUTH BUTTON */}
          {!user ? (
            <Link
              href="/login"
              className="px-4 py-2 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition"
            >
              Login
            </Link>
          ) : (
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition"
            >
              Logout
            </button>
          )}

          {/* PROFILE ICON (ONLY IF LOGGED IN) */}
          {user && (
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md"
              >
                <User size={18} />
              </button>

              {open && (
                <div className="absolute right-0 top-14 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-lg mb-3">
                    👋 Chaitanya Deep
                  </h3>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Mail size={16} />
                    chaitanyadeep75@gmail.com
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={16} />
                    9963225519
                  </div>

                  <button
                    onClick={handleLogout}
                    className="mt-4 w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
