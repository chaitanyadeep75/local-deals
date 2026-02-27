'use client';

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { supabase } from '@/app/lib/supabase';
import { getCategoryLabel } from '@/app/lib/categories';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import {
  Bookmark, Star, User as UserIcon, Mail, LogOut,
  MapPin, Trash2, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type SavedDeal = {
  id: number;
  deal_id: number;
  created_at: string;
  deals: {
    id: number;
    title: string;
    description: string;
    image: string | null;
    city: string | null;
    area: string | null;
    valid_till_date: string | null;
    category: string | null;
  };
};

type SavedDealRow = {
  id: number;
  deal_id: number;
  created_at: string;
  deals: SavedDeal['deals'] | SavedDeal['deals'][] | null;
};

type UserReview = {
  id: number;
  deal_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  deals: {
    id: number;
    title: string;
    image: string | null;
    city: string | null;
    area: string | null;
  } | null;
};

type UserReviewRow = {
  id: number;
  deal_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  deals: UserReview['deals'] | UserReview['deals'][] | null;
};

type Tab = 'saved' | 'reviews' | 'account';

export default function UserProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [savedDeals, setSavedDeals] = useState<SavedDeal[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [tab, setTab] = useState<Tab>('saved');
  const [loading, setLoading] = useState(true);

  async function fetchSaved(userId: string) {
    const { data } = await supabase
      .from('saved_deals')
      .select('id, deal_id, created_at, deals(id, title, description, image, city, area, valid_till_date, category)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const rows = ((data || []) as SavedDealRow[])
      .map((row) => {
        const related = Array.isArray(row.deals) ? row.deals[0] : row.deals;
        if (!related) return null;
        return {
          id: row.id,
          deal_id: row.deal_id,
          created_at: row.created_at,
          deals: related,
        } satisfies SavedDeal;
      })
      .filter((row): row is SavedDeal => row !== null);
    setSavedDeals(rows);
  }

  async function fetchReviews(userId: string) {
    const { data } = await supabase
      .from('reviews')
      .select('id, deal_id, rating, comment, created_at, deals(id, title, image, city, area)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const rows = ((data || []) as UserReviewRow[]).map((row) => {
      const related = Array.isArray(row.deals) ? row.deals[0] : row.deals;
      return {
        id: row.id,
        deal_id: row.deal_id,
        rating: row.rating,
        comment: row.comment,
        created_at: row.created_at,
        deals: related || null,
      } satisfies UserReview;
    });
    setReviews(rows);
  }

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.replace('/user/login'); return; }
      const role = data.user.user_metadata?.role;
      if (role === 'business' || localStorage.getItem('ld_role_hint') === 'business') {
        router.replace('/business/dashboard');
        return;
      }
      setUser(data.user);
      await Promise.all([fetchSaved(data.user.id), fetchReviews(data.user.id)]);
      setLoading(false);
    };
    init();
  }, [router]);

  const removeSaved = async (savedId: number) => {
    await supabase.from('saved_deals').delete().eq('id', savedId);
    setSavedDeals((prev) => prev.filter((s) => s.id !== savedId));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const displayName = user?.user_metadata?.full_name
    || user?.email?.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    || 'User';

  const tabs: { key: Tab; label: string; icon: ComponentType<{ size?: number }> }[] = [
    { key: 'saved', label: 'Saved Deals', icon: Bookmark },
    { key: 'reviews', label: 'My Reviews', icon: Star },
    { key: 'account', label: 'Account', icon: UserIcon },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pb-24">

      {/* PROFILE HERO */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/10 rounded-full" />

        <div className="relative px-6 pt-10 pb-16 text-white">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-bold border-2 border-white/40 mb-4">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="text-white/80 text-sm mt-1 flex items-center gap-1.5">
            <Mail size={13} />
            {user?.email}
          </p>
          <div className="flex gap-4 mt-4 text-sm">
            <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2 text-center">
              <p className="font-bold text-lg">{savedDeals.length}</p>
              <p className="text-white/80 text-xs">Saved</p>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2 text-center">
              <p className="font-bold text-lg">{reviews.length}</p>
              <p className="text-white/80 text-xs">Reviews</p>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm -mt-4 rounded-t-3xl overflow-hidden">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex flex-col items-center gap-1 py-3.5 text-xs font-medium transition-all
              ${tab === t.key
                ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50'
                : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            <t.icon size={18} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-6 pt-6 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">

          {/* ── SAVED DEALS ── */}
          {tab === 'saved' && (
            <motion.div key="saved" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {savedDeals.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <Bookmark size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-gray-600">No saved deals yet</p>
                  <p className="text-sm mt-1">Tap the bookmark icon on any deal to save it</p>
                  <Link href="/" className="inline-block mt-4 text-emerald-600 font-medium hover:underline text-sm">
                    Browse deals →
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedDeals.map((s) => (
                    <motion.div
                      key={s.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex"
                    >
                      {s.deals?.image ? (
                        <img src={s.deals.image} alt={s.deals.title} className="w-24 h-24 object-cover shrink-0" />
                      ) : (
                        <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 shrink-0" />
                      )}
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{s.deals?.title}</p>
                            {s.deals?.category && (
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full capitalize">
                                {getCategoryLabel(s.deals.category)}
                              </span>
                            )}
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <MapPin size={10} />
                              {[s.deals?.area, s.deals?.city].filter(Boolean).join(', ') || 'Location not set'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Valid till {s.deals?.valid_till_date
                                ? new Date(s.deals.valid_till_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                : 'No expiry'}
                            </p>
                          </div>
                          <button onClick={() => removeSaved(s.id)} className="text-gray-300 hover:text-red-400 transition shrink-0">
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <Link
                          href={`/deal/${s.deals?.id}`}
                          className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1 hover:gap-2 transition-all"
                        >
                          View deal <ChevronRight size={12} />
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── REVIEWS ── */}
          {tab === 'reviews' && (
            <motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {reviews.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <Star size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-gray-600">No reviews yet</p>
                  <p className="text-sm mt-1">Rate deals you&apos;ve visited to share with the community</p>
                  <Link href="/" className="inline-block mt-4 text-emerald-600 font-medium hover:underline text-sm">
                    Browse deals →
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex">
                      {review.deals?.image ? (
                        <img src={review.deals.image} alt={review.deals.title} className="w-24 h-24 object-cover shrink-0" />
                      ) : (
                        <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 shrink-0" />
                      )}
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{review.deals?.title || 'Deal'}</p>
                            <p className="text-xs text-amber-500 mt-0.5">
                              {'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <MapPin size={10} />
                              {[review.deals?.area, review.deals?.city].filter(Boolean).join(', ') || 'Location not set'}
                            </p>
                            {review.comment && (
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{review.comment}</p>
                            )}
                            <p className="text-[11px] text-gray-400 mt-1">
                              {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/deal/${review.deal_id}`}
                          className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1 hover:gap-2 transition-all"
                        >
                          View deal <ChevronRight size={12} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── ACCOUNT ── */}
          {tab === 'account' && (
            <motion.div key="account" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-4">

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Account Info</p>
                </div>
                <div className="px-5 py-4 flex items-center gap-3">
                  <UserIcon size={16} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">Name</p>
                    <p className="font-medium text-sm text-gray-800">{displayName}</p>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-gray-50 flex items-center gap-3">
                  <Mail size={16} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="font-medium text-sm text-gray-800">{user?.email}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Activity</p>
                </div>
                <div className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bookmark size={16} className="text-emerald-500" />
                    <p className="text-sm text-gray-700">Saved deals</p>
                  </div>
                  <span className="font-bold text-emerald-600">{savedDeals.length}</span>
                </div>
                <div className="px-5 py-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Star size={16} className="text-amber-500" />
                    <p className="text-sm text-gray-700">Reviews posted</p>
                  </div>
                  <span className="font-bold text-amber-600">{reviews.length}</span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-600 py-3.5 rounded-2xl font-medium hover:bg-red-100 transition"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}
