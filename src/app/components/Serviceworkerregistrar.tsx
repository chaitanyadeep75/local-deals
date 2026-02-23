'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Service workers don't work with Next.js Turbopack dev server.
    // Only register in production where sw.js is properly served.
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => console.log('[SW] Registered, scope:', reg.scope))
      .catch((err) => console.error('[SW] Registration failed:', err));
  }, []);

  return null;
}