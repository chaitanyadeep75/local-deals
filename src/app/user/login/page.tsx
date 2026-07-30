'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function RedirectContent() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login' + window.location.search);
  }, [router]);
  return null;
}

export default function UserLoginRedirect() {
  return (
    <Suspense fallback={null}>
      <RedirectContent />
    </Suspense>
  );
}
