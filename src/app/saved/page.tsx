'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Sparkles } from 'lucide-react';
import { supabase } from '@/app/lib/supabase';
import DealCard from '@/app/components/DealCard';

type Deal = {
  id: number;
  title: string;
  description: string;
  city: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  valid_till_date: string | null;
  views: number;
  clicks: number;
  image?: string | null;
  image_urls?: string[] | null;
  rating?: number | null;
  rating_count?: number | null;
  offer_price?: string | null;
  original_price?: string | null;
  discount_label?: string | null;
  category?: string | null;
  coupon_code?: string | null;
  redemption_mode?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  is_verified?: boolean | null;
  updated_at?: string | null;
  status?: string | null;
  created_at?: string | null;
  is_boosted?: boolean | null;
  boost_until?: string | null;
};

type SavedRow = { id: number; created_at: string; deals: Deal | Deal[] | null };

type AuthState = 'checking' | 'guest' | 'authed';

export default function SavedDealsPage() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('ld_last_coords');
      if (raw) {
        const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCoords({ lat: parsed.lat, lng: parsed.lng });
        }
      }
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setAuthState('guest'); setLoading(false); return; }
      setAuthState('authed');
      const res = await supabase
        .from('saved_deals')
        .select('id, created_at, deals(*)')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false });
      const rows = ((res.data || []) as SavedRow[])
        .map((row) => (Array.isArray(row.deals) ? row.deals[0] : row.deals))
        .filter((d): d is Deal => !!d);
      setDeals(rows);
      setLoading(false);
    };
    init();
  }, []);

  return (
    <main className="relative min-h-screen pb-16">
      <div className="mb-6 flex items-center gap-3 pt-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/80">
          <Bookmark size={16} className="text-emerald-400" fill="currentColor" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Saved Deals</h1>
        {authState === 'authed' && !loading && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
            {deals.length} saved
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-white/8 bg-slate-900/80">
              <div className="h-48 bg-slate-800/70" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-3/4 rounded-lg bg-slate-800/70" />
                <div className="h-3 w-1/2 rounded-lg bg-slate-800/50" />
              </div>
            </div>
          ))}
        </div>
      ) : authState === 'guest' ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/80">
            <Bookmark size={28} className="text-slate-500" />
          </div>
          <p className="text-lg font-bold text-slate-300">Sign in to see your saved deals</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
            Save deals you love and find them here anytime, on any device.
          </p>
          <Link
            href="/login?next=%2Fsaved"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
          >
            Sign In
          </Link>
        </div>
      ) : deals.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/80">
            <Sparkles size={28} className="text-slate-500" />
          </div>
          <p className="text-lg font-bold text-slate-300">Nothing saved yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
            Tap the bookmark on any deal to keep it here for later.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
          >
            Browse deals
          </Link>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5 xl:grid-cols-3">
          <AnimatePresence>
            {deals.map((deal, i) => (
              <motion.div
                key={deal.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(i, 8) * 0.05 }}
              >
                <DealCard
                  deal={deal}
                  userLat={coords?.lat}
                  userLng={coords?.lng}
                  onUnsave={(dealId) => setDeals((prev) => prev.filter((d) => d.id !== dealId))}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </main>
  );
}
