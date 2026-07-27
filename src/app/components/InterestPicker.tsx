'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { CATEGORY_OPTIONS, getCategoryMeta } from '@/app/lib/categories';
import { trackEvent } from '@/app/lib/analytics';

export const ONBOARDED_KEY = 'ld_onboarded';
export const SAVED_CATEGORIES_KEY = 'ld_saved_categories';

export function readSavedInterests(): string[] {
  try {
    const raw = window.localStorage.getItem(SAVED_CATEGORIES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

export default function InterestPicker({
  mode = 'onboarding',
  initialPicked = [],
  onDone,
  onCancel,
}: {
  /** 'onboarding' merges picks into existing interests and marks onboarding done; 'edit' replaces the list. */
  mode?: 'onboarding' | 'edit';
  initialPicked?: string[];
  onDone: (picked: string[]) => void;
  onCancel?: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(initialPicked);
  const isEdit = mode === 'edit';

  const toggle = (value: string) =>
    setPicked((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const finish = (categories: string[]) => {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, '1');
      if (isEdit) {
        window.localStorage.setItem(SAVED_CATEGORIES_KEY, JSON.stringify(categories.slice(0, 12)));
      } else if (categories.length) {
        const prev = readSavedInterests();
        const next = Array.from(new Set([...categories, ...prev])).slice(0, 12);
        window.localStorage.setItem(SAVED_CATEGORIES_KEY, JSON.stringify(next));
      }
    } catch { /* localStorage unavailable — skip persistence */ }
    void trackEvent(isEdit ? 'interests_edited' : 'onboarding_interests', { picked: categories, count: categories.length });
    onDone(categories);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <motion.div
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900/98 shadow-[0_-16px_80px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:rounded-3xl"
      >
        <div className="px-5 pt-5">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
              <Sparkles size={15} className="text-white" />
            </div>
            <h3 className="text-lg font-black text-white">{isEdit ? 'Your interests' : 'Make it yours'}</h3>
          </div>
          <p className="text-sm text-slate-500">
            {isEdit
              ? 'These tune your personalized feed. Tap to add or remove.'
              : 'Pick what you love — your feed gets tuned to it. You can always change later.'}
          </p>
        </div>

        <div className="max-h-[45vh] overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((cat) => {
              const meta = getCategoryMeta(cat.value);
              const active = picked.includes(cat.value);
              return (
                <button
                  key={cat.value}
                  onClick={() => toggle(cat.value)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-all duration-150 active:scale-95 ${
                    active
                      ? 'border-violet-500/50 bg-violet-500/20 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.25)]'
                      : 'border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  <span className="text-base leading-none">{meta.emoji}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="flex items-center gap-3 border-t border-white/8 px-5 py-4"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => (isEdit ? onCancel?.() : finish([]))}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:text-slate-300"
          >
            {isEdit ? 'Cancel' : 'Skip'}
          </button>
          <button
            onClick={() => finish(picked)}
            disabled={!isEdit && picked.length === 0}
            className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {isEdit
              ? `Save interests (${picked.length})`
              : picked.length === 0
              ? 'Pick at least one'
              : `Personalize my feed (${picked.length})`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
