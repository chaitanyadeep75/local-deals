'use client';

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { supabase } from '@/app/lib/supabase';
import { getCategoryLabel, getCategoryMeta } from '@/app/lib/categories';
import InterestPicker, { readSavedInterests } from '@/app/components/InterestPicker';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import {
  Bookmark, Star, User as UserIcon, Mail, LogOut,
  MapPin, Trash2, ChevronRight, Bell, Share2, Copy, Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getOrCreateReferralCode } from '@/app/lib/growth';
import { subscribeToPush, unsubscribeFromPush, isPushSupported } from '@/app/lib/push';

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
  const [notifPrefs, setNotifPrefs] = useState({
    push_enabled: true,
    whatsapp_enabled: false,
    ending_soon_enabled: true,
    price_drop_enabled: true,
    new_nearby_enabled: true,
  });
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [editingInterests, setEditingInterests] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setInterests(readSavedInterests()); }, []);

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
      const prefRes = await supabase
        .from('notification_preferences')
        .select('push_enabled, whatsapp_enabled, ending_soon_enabled, price_drop_enabled, new_nearby_enabled')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (prefRes.data) {
        setNotifPrefs({
          push_enabled: prefRes.data.push_enabled ?? true,
          whatsapp_enabled: prefRes.data.whatsapp_enabled ?? false,
          ending_soon_enabled: prefRes.data.ending_soon_enabled ?? true,
          price_drop_enabled: prefRes.data.price_drop_enabled ?? true,
          new_nearby_enabled: prefRes.data.new_nearby_enabled ?? true,
        });
      }
      const code = await getOrCreateReferralCode(data.user.id, 'profile');
      setReferralCode(code);
      const refRes = await supabase
        .from('user_referrals')
        .select('id', { count: 'exact', head: true })
        .eq('inviter_user_id', data.user.id)
        .eq('status', 'converted');
      setReferralCount(refRes.count || 0);
      setLoading(false);
    };
    init();
  }, [router]);

  const saveNotificationPrefs = async () => {
    if (!user) return;
    setPushStatus(null);
    await supabase.from('notification_preferences').upsert({
      user_id: user.id,
      ...notifPrefs,
      updated_at: new Date().toISOString(),
    });

    if (notifPrefs.push_enabled) {
      if (!isPushSupported()) {
        setPushStatus('Push notifications aren’t supported in this browser.');
      } else {
        const ok = await subscribeToPush(user.id);
        setPushStatus(ok
          ? 'Push alerts are on for this device.'
          : 'Couldn’t enable push — check notification permission for this site.');
      }
    } else {
      await unsubscribeFromPush();
      setPushStatus('Push alerts are off for this device.');
    }
  };

  const copyReferralLink = async () => {
    if (!user || !referralCode) return;
    const link = `${window.location.origin}/user/signup?ref=${encodeURIComponent(referralCode)}`;
    await navigator.clipboard.writeText(link);
  };

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
      <div className="flex justify-center items-center h-screen bg-[#020617]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] pb-24">

      {/* PROFILE HERO */}
      <div className="relative overflow-hidden bg-slate-900/80 border-b border-white/10">
        {/* Decorative accents */}
        <div className="absolute -top-16 -right-10 w-56 h-56 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-6 pt-10 pb-8">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-3xl font-extrabold text-white shadow-neon-violet mb-4">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">{displayName}</h1>
          <p className="text-slate-400 text-sm mt-1 flex items-center gap-1.5">
            <Mail size={13} />
            {user?.email}
          </p>
          <div className="flex gap-3 mt-4 text-sm">
            <div className="bg-slate-800/80 border border-white/10 rounded-2xl px-4 py-2 text-center">
              <p className="font-bold text-lg text-slate-50">{savedDeals.length}</p>
              <p className="text-slate-500 text-xs">Saved</p>
            </div>
            <div className="bg-slate-800/80 border border-white/10 rounded-2xl px-4 py-2 text-center">
              <p className="font-bold text-lg text-slate-50">{reviews.length}</p>
              <p className="text-slate-500 text-xs">Reviews</p>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-slate-950/95 backdrop-blur-xl border-b border-white/10 sticky top-0 z-20">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex-1 flex flex-col items-center gap-1 py-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
              ${tab === t.key ? 'text-slate-50' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <t.icon size={18} />
            {t.label}
            {tab === t.key && (
              <motion.div
                layoutId="profile-tab-indicator"
                className="absolute bottom-0 inset-x-5 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-neon-violet"
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="px-4 sm:px-6 pt-6 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">

          {/* ── SAVED DEALS ── */}
          {tab === 'saved' && (
            <motion.div key="saved" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {savedDeals.length === 0 ? (
                <div className="flex flex-col items-center text-center py-20 px-6">
                  <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center mb-4">
                    <Bookmark size={24} className="text-slate-500" />
                  </div>
                  <p className="font-semibold text-sm text-slate-200">No saved deals yet</p>
                  <p className="text-sm text-slate-500 mt-1 max-w-xs leading-relaxed">Tap the bookmark icon on any deal to save it for later</p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1 mt-5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-xs font-semibold text-white shadow-neon-violet transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                  >
                    Browse deals <ChevronRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedDeals.map((s, i) => (
                    <motion.div
                      key={s.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.05 }}
                      className="card-press flex bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden"
                    >
                      {s.deals?.image ? (
                        <img src={s.deals.image} alt={s.deals.title} className="w-24 h-24 object-cover shrink-0" />
                      ) : (
                        <div className="w-24 h-24 bg-slate-800 shrink-0" />
                      )}
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-100 truncate">{s.deals?.title}</p>
                            {s.deals?.category && (
                              <span className="inline-block mt-1 text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded-full capitalize">
                                {getCategoryLabel(s.deals.category)}
                              </span>
                            )}
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <MapPin size={10} />
                              {[s.deals?.area, s.deals?.city].filter(Boolean).join(', ') || 'Location not set'}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Valid till {s.deals?.valid_till_date
                                ? new Date(s.deals.valid_till_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                : 'No expiry'}
                            </p>
                          </div>
                          <button
                            onClick={() => removeSaved(s.id)}
                            aria-label="Remove saved deal"
                            className="text-slate-600 hover:text-rose-400 transition shrink-0 p-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <Link
                          href={`/deal/${s.deals?.id}`}
                          className="mt-2 w-fit text-xs text-violet-400 font-medium flex items-center gap-1 hover:gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded"
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
                <div className="flex flex-col items-center text-center py-20 px-6">
                  <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-white/10 flex items-center justify-center mb-4">
                    <Star size={24} className="text-slate-500" />
                  </div>
                  <p className="font-semibold text-sm text-slate-200">No reviews yet</p>
                  <p className="text-sm text-slate-500 mt-1 max-w-xs leading-relaxed">Rate deals you&apos;ve visited to share with the community</p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1 mt-5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-xs font-semibold text-white shadow-neon-violet transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                  >
                    Browse deals <ChevronRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review, i) => (
                    <motion.div
                      key={review.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.05 }}
                      className="flex bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden"
                    >
                      {review.deals?.image ? (
                        <img src={review.deals.image} alt={review.deals.title} className="w-24 h-24 object-cover shrink-0" />
                      ) : (
                        <div className="w-24 h-24 bg-slate-800 shrink-0" />
                      )}
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-100 truncate">{review.deals?.title || 'Deal'}</p>
                            <p className="text-xs text-amber-400 mt-0.5">
                              {'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <MapPin size={10} />
                              {[review.deals?.area, review.deals?.city].filter(Boolean).join(', ') || 'Location not set'}
                            </p>
                            {review.comment && (
                              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{review.comment}</p>
                            )}
                            <p className="text-[11px] text-slate-500 mt-1">
                              {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/deal/${review.deal_id}`}
                          className="mt-2 w-fit text-xs text-violet-400 font-medium flex items-center gap-1 hover:gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded"
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

          {/* ── ACCOUNT ── */}
          {tab === 'account' && (
            <motion.div key="account" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-6">

              <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Account Info</p>
                </div>
                <div className="px-5 py-4 flex items-center gap-3">
                  <UserIcon size={16} className="text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Name</p>
                    <p className="font-medium text-sm text-slate-200">{displayName}</p>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-white/10 flex items-center gap-3">
                  <Mail size={16} className="text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="font-medium text-sm text-slate-200">{user?.email}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Activity</p>
                </div>
                <div className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bookmark size={16} className="text-violet-400" />
                    <p className="text-sm text-slate-300">Saved deals</p>
                  </div>
                  <span className="font-bold text-violet-300">{savedDeals.length}</span>
                </div>
                <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Star size={16} className="text-amber-400" />
                    <p className="text-sm text-slate-300">Reviews posted</p>
                  </div>
                  <span className="font-bold text-amber-300">{reviews.length}</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">My Interests</p>
                  <button
                    onClick={() => setEditingInterests(true)}
                    aria-label="Edit interests"
                    className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                  >
                    <Sparkles size={12} /> Edit
                  </button>
                </div>
                <div className="px-5 py-4">
                  {interests.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No interests picked yet — add some to get a personalized feed.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {interests.map((cat) => (
                        <span key={cat} className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-300">
                          <span>{getCategoryMeta(cat).emoji}</span>
                          {getCategoryLabel(cat)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Notifications</p>
                </div>
                <div className="px-5 py-4 space-y-3 text-sm">
                  {[
                    { key: 'push_enabled', label: 'Push alerts' },
                    { key: 'whatsapp_enabled', label: 'WhatsApp alerts' },
                    { key: 'ending_soon_enabled', label: 'Ending soon deals' },
                    { key: 'price_drop_enabled', label: 'Price drops' },
                    { key: 'new_nearby_enabled', label: 'New nearby deals' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-slate-300"><Bell size={14} className="text-slate-500" /> {item.label}</span>
                      <input
                        type="checkbox"
                        checked={notifPrefs[item.key as keyof typeof notifPrefs]}
                        onChange={(e) => setNotifPrefs((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                        className="accent-violet-500 w-4 h-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                      />
                    </label>
                  ))}
                  <button
                    onClick={saveNotificationPrefs}
                    className="mt-3 w-full sm:w-auto rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-xs font-semibold text-white shadow-neon-violet transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                  >
                    Save notification preferences
                  </button>
                  {pushStatus && <p className="text-xs text-slate-500">{pushStatus}</p>}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Referral & Invite</p>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <p className="text-sm text-slate-300">Friends joined: <span className="font-semibold text-violet-300">{referralCount}</span></p>
                  <p className="rounded-xl bg-slate-800/80 border border-white/10 px-3 py-2 font-mono text-xs text-slate-300">{referralCode}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={copyReferralLink}
                      className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    >
                      <Share2 size={13} /> Invite friends
                    </button>
                    <button
                      onClick={copyReferralLink}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    >
                      <Copy size={13} /> Copy invite link
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 py-3.5 rounded-2xl font-semibold hover:bg-rose-500/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {editingInterests && (
        <InterestPicker
          mode="edit"
          initialPicked={interests}
          onCancel={() => setEditingInterests(false)}
          onDone={(picked) => { setInterests(picked); setEditingInterests(false); }}
        />
      )}
    </main>
  );
}
