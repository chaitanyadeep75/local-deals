'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  if (!visible || !deferred) return null;

  return (
    <div className="fixed bottom-20 right-3 z-50 rounded-xl border border-indigo-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur md:bottom-4">
      <p className="font-semibold text-slate-800">Install LocalDeals app?</p>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setVisible(false);
            setDeferred(null);
          }}
          className="rounded-lg bg-indigo-600 px-2.5 py-1 font-semibold text-white"
        >
          Install
        </button>
        <button onClick={() => setVisible(false)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600">
          Not now
        </button>
      </div>
    </div>
  );
}
