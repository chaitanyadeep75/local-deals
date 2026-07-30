'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { attributeReferral } from '@/app/lib/growth';
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

      const { data } = await supabase.auth.getUser();
      let role = data.user?.user_metadata?.role as string | undefined;

      if (data.user) {
        // A fresh OAuth signup (account created moments ago) that started
        // from the Business tab carries `role=business` through this
        // redirect — apply it once, the same way `ref` is threaded below.
        const roleParam = params.get('role');
        const createdAt = data.user.created_at ? new Date(data.user.created_at).getTime() : 0;
        const isFreshSignup = !!createdAt && Date.now() - createdAt < 2 * 60 * 1000;

        if (roleParam === 'business' && !role && isFreshSignup) {
          await supabase.auth.updateUser({ data: { ...data.user.user_metadata, role: 'business' } });
          role = 'business';
        }

        // Attribute a referral only on that same fresh-signup window, not on
        // every subsequent login.
        const refCode = params.get('ref');
        if (refCode && isFreshSignup) {
          void attributeReferral(refCode, data.user.id);
        }
      }

      const next = params.get('next') || '/';
      router.replace(role === 'business' ? '/business/dashboard' : next);
    };
    run();
  }, [params, router]);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-neon-violet">
          <Zap size={24} className="text-white" fill="white" />
        </div>
        <div>
          <p className="text-base font-bold tracking-tight text-white">Signing you in…</p>
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
