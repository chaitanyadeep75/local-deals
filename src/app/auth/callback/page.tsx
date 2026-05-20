'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { Zap } from 'lucide-react';

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const code = params.get('code');
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      // Set role hint for newly OAuth-authenticated users
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const role = data.user.user_metadata?.role;
        if (!role || role === 'user') {
          localStorage.setItem('ld_role_hint', 'user');
        }
      }

      const next = params.get('next') || '/';
      router.replace(next);
    };
    run();
  }, [params, router]);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-neon-violet">
          <Zap size={24} className="text-white" fill="white" />
        </div>
        <div>
          <p className="text-base font-bold text-white">Signing you in…</p>
          <p className="mt-1 text-sm text-slate-500">Just a moment</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-violet-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <Suspense>
          <CallbackHandler />
        </Suspense>
      </div>
    </main>
  );
}
