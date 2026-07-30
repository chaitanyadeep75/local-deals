'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, X } from 'lucide-react';

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

  return (
    <AnimatePresence>
      {visible && deferred && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-20 right-3 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-card backdrop-blur-2xl md:bottom-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 border border-violet-500/30">
              <Download size={16} className="text-violet-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Install LocalDeals</p>
              <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                Add the app to your home screen for quick, full-screen access.
              </p>
            </div>
            <button
              onClick={() => setVisible(false)}
              aria-label="Dismiss install prompt"
              className="shrink-0 rounded-full p-1 text-slate-500 transition-colors duration-150 hover:bg-white/10 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={async () => {
                await deferred.prompt();
                await deferred.userChoice;
                setVisible(false);
                setDeferred(null);
              }}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-xs font-semibold text-white shadow-neon-violet transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
            >
              Install
            </button>
            <button
              onClick={() => setVisible(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
            >
              Not now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
