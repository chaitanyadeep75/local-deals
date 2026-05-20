'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import DealCard from '@/app/components/DealCard';
import { CATEGORY_FILTERS, categoryMatchesFilter, getCategoryLabel, getCategoryMeta } from '@/app/lib/categories';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LocateFixed,
  X,
  SlidersHorizontal,
  AlertCircle,
  Info,
  Sparkles,
  Trophy,
  Clock3,
  Flame,
  MapPinned,
  List,
  WifiOff,
  TrendingUp,
  Tag,
  ChevronRight,
} from 'lucide-react';
import { getUrgencyLabel } from '@/app/lib/deal-utils';
import Link from 'next/link';

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
  rating?: number | null;
  rating_count?: number | null;
  category?: string | null;
  offer_price?: string | null;
  original_price?: string | null;
  discount_label?: string | null;
  coupon_code?: string | null;
  terms?: string | null;
  redemption_mode?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  is_verified?: boolean | null;
  updated_at?: string | null;
  status?: string | null;
  is_boosted?: boolean | null;
  boost_until?: string | null;
};

type FeedMode = 'for-you' | 'personalized' | 'top-rated' | 'ending-soon' | 'trending';
type ViewMode = 'list' | 'map';

const RADIUS_OPTIONS = [
  { label: '1 km', value: 1 },
  { label: '3 km', value: 3 },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getLocationByIP(): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if (data.latitude && data.longitude) return { lat: data.latitude, lng: data.longitude };
    return null;
  } catch { return null; }
}

type GeoStatus = 'idle' | 'loading' | 'active' | 'ip-fallback' | 'denied' | 'error';

const FEED_MODES: { key: FeedMode; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'for-you', label: 'For You', icon: Sparkles },
  { key: 'personalized', label: 'Personalized', icon: TrendingUp },
  { key: 'top-rated', label: 'Top Rated', icon: Trophy },
  { key: 'ending-soon', label: 'Ending Soon', icon: Clock3 },
  { key: 'trending', label: 'Trending', icon: Flame },
];

export default function HomePage() {
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showExpired, setShowExpired] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<FeedMode>('for-you');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [networkIssue, setNetworkIssue] = useState<string | null>(null);
  const [recentDeals, setRecentDeals] = useState<Deal[]>([]);
  const [isBusiness, setIsBusiness] = useState(false);

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [nearMeActive, setNearMeActive] = useState(false);
  const [nearMeRadius, setNearMeRadius] = useState(5);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);

  const fetchDeals = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const runQuery = async (withStatus: boolean) => {
      let query = supabase.from('deals').select('*');
      if (withStatus) query = query.eq('status', 'active');
      if (!showExpired) query = query.or(`valid_till_date.is.null,valid_till_date.gte.${today}`);
      return query.order('created_at', { ascending: false });
    };

    let { data, error } = await runQuery(true);
    if (error && (error.code === '42703' || String(error.message || '').toLowerCase().includes('status'))) {
      ({ data, error } = await runQuery(false));
    }
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      setNetworkIssue(msg.includes('fetch') || msg.includes('network')
        ? 'Network issue while loading deals. Please retry.'
        : 'Could not load deals right now. Please retry.');
      setAllDeals([]);
      return;
    }
    setNetworkIssue(null);
    setAllDeals(data || []);
  }, [showExpired]);

  useEffect(() => {
    setShowOnboarding(localStorage.getItem('ld_onboarding_done') !== '1');
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const role = data.user.user_metadata?.role;
      if (role === 'business') setIsBusiness(true);
    });
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchDeals(); }, [fetchDeals]);

  useEffect(() => {
    const raw = localStorage.getItem('ld_recent_viewed');
    const ids = raw ? (JSON.parse(raw) as number[]) : [];
    if (!ids.length) return;
    supabase.from('deals').select('*').in('id', ids.slice(0, 6)).then(({ data }) => {
      if (!data) return;
      const byId = new Map(data.map((d) => [d.id, d]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as Deal[];
      setRecentDeals(ordered);
    });
  }, []);

  const deals = useMemo(() => {
    let filtered = [...allDeals];
    filtered = filtered.filter((d) => categoryMatchesFilter(d.category, selectedCategory));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.city?.toLowerCase().includes(q) ||
          d.area?.toLowerCase().includes(q) ||
          d.category?.toLowerCase().includes(q) ||
          getCategoryLabel(d.category).toLowerCase().includes(q)
      );
    }
    if (nearMeActive && userLat !== null && userLng !== null) {
      filtered = filtered.filter((d) => {
        if (!d.latitude || !d.longitude) return false;
        return haversineKm(userLat, userLng, d.latitude, d.longitude) <= nearMeRadius;
      });
      filtered.sort((a, b) => {
        const da = haversineKm(userLat, userLng, a.latitude!, a.longitude!);
        const db = haversineKm(userLat, userLng, b.latitude!, b.longitude!);
        return da - db;
      });
    }
    return filtered;
  }, [allDeals, selectedCategory, searchQuery, nearMeActive, userLat, userLng, nearMeRadius]);

  const activateWithCoords = (lat: number, lng: number, isIP = false) => {
    setUserLat(lat); setUserLng(lng); setNearMeActive(true);
    setGeoStatus(isIP ? 'ip-fallback' : 'active');
  };

  const tryIPFallback = async () => {
    const ipLoc = await getLocationByIP();
    if (ipLoc) activateWithCoords(ipLoc.lat, ipLoc.lng, true);
    else setGeoStatus('error');
  };

  const handleNearMe = () => {
    if (nearMeActive) { setNearMeActive(false); setGeoStatus('idle'); return; }
    if (userLat && userLng) {
      setNearMeActive(true);
      setGeoStatus(geoStatus === 'ip-fallback' ? 'ip-fallback' : 'active');
      return;
    }
    setGeoStatus('loading');
    if (!navigator.geolocation) { tryIPFallback(); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => activateWithCoords(pos.coords.latitude, pos.coords.longitude),
      async (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus('denied');
          const ipLoc = await getLocationByIP();
          if (ipLoc) activateWithCoords(ipLoc.lat, ipLoc.lng, true);
        } else { await tryIPFallback(); }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const clearAll = () => {
    setSelectedCategory('all'); setSearchQuery('');
    setNearMeActive(false); setGeoStatus('idle'); setFeedMode('for-you');
  };

  const isFiltering = searchQuery.trim().length > 0 || nearMeActive || selectedCategory !== 'all';

  const displayedDeals = useMemo(() => {
    const boostRank = (deal: Deal) => {
      if (!deal.is_boosted || !deal.boost_until) return 0;
      const ts = new Date(deal.boost_until).getTime();
      return Number.isFinite(ts) && ts > Date.now() ? 1 : 0;
    };
    const boostFirst = (a: Deal, b: Deal) => boostRank(b) - boostRank(a);
    const sorted = [...deals];
    if (feedMode === 'personalized') {
      const rawSaved = typeof window !== 'undefined' ? window.localStorage.getItem('ld_saved_categories') : null;
      const favoriteCats = rawSaved ? (JSON.parse(rawSaved) as string[]) : [];
      const recentIdsRaw = typeof window !== 'undefined' ? window.localStorage.getItem('ld_recent_viewed') : null;
      const recentIds = recentIdsRaw ? (JSON.parse(recentIdsRaw) as number[]) : [];
      return sorted.sort((a, b) => {
        const boostDiff = boostFirst(a, b);
        if (boostDiff !== 0) return boostDiff;
        const aFav = favoriteCats.includes((a.category || '').toLowerCase()) ? 1 : 0;
        const bFav = favoriteCats.includes((b.category || '').toLowerCase()) ? 1 : 0;
        const aRecent = recentIds.includes(a.id) ? 1 : 0;
        const bRecent = recentIds.includes(b.id) ? 1 : 0;
        const aScore = aFav * 30 + aRecent * 15 + (a.rating || 0) * 5 + (a.clicks || 0) * 0.6 + (a.views || 0) * 0.2;
        const bScore = bFav * 30 + bRecent * 15 + (b.rating || 0) * 5 + (b.clicks || 0) * 0.6 + (b.views || 0) * 0.2;
        return bScore - aScore;
      });
    }
    if (feedMode === 'top-rated') return sorted.sort((a, b) => boostFirst(a, b) || (b.rating || 0) - (a.rating || 0) || (b.rating_count || 0) - (a.rating_count || 0));
    if (feedMode === 'ending-soon') {
      return sorted.sort((a, b) => {
        const boostDiff = boostFirst(a, b);
        if (boostDiff !== 0) return boostDiff;
        const ad = a.valid_till_date ? new Date(a.valid_till_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.valid_till_date ? new Date(b.valid_till_date).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });
    }
    if (feedMode === 'trending') return sorted.sort((a, b) => boostFirst(a, b) || ((b.clicks || 0) + (b.views || 0)) - ((a.clicks || 0) + (a.views || 0)));
    return sorted.sort(boostFirst);
  }, [deals, feedMode]);

  const spotlightDeal = displayedDeals[0] || null;
  const endingSoonDeals = displayedDeals
    .filter((d) => { const l = getUrgencyLabel(d.valid_till_date); return l && l !== 'Expired'; })
    .slice(0, 4);
  const communityPicks = [...displayedDeals]
    .sort((a, b) => ((b.rating_count || 0) + (b.clicks || 0)) - ((a.rating_count || 0) + (a.clicks || 0)))
    .slice(0, 6);
  const dealsEndingToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return allDeals.filter((d) => d.valid_till_date === today).length;
  }, [allDeals]);

  const searchSuggestions = useMemo(() => {
    const bucket = new Set<string>();
    for (const d of allDeals) {
      [d.title, d.area || '', d.city || '', getCategoryLabel(d.category)].forEach((v) => {
        const s = String(v || '').trim();
        if (s && s.length >= 3) bucket.add(s);
      });
      if (bucket.size >= 20) break;
    }
    return Array.from(bucket).slice(0, 20);
  }, [allDeals]);

  return (
    <main className="relative min-h-screen pb-16">

      {/* ── Hero ── */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
        <div className="relative mb-6 mt-2 overflow-hidden rounded-2xl border border-white/10 md:mb-8 md:mt-4">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-700" />
          {/* Noise/texture overlay */}
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.15\'/%3E%3C/svg%3E")', backgroundSize: '200px' }} />
          {/* Glowing orbs inside hero */}
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-fuchsia-300/20 blur-3xl" />

          <div className="relative px-4 py-5 text-white md:px-10 md:py-10">
            <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Sparkles size={11} className="text-yellow-300" />
              Live deals · updated daily
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl lg:text-5xl">
              Every Deal Near You.
              <br />
              <span className="text-yellow-300">Every Kind of Shop.</span>
            </h1>
            <p className="mt-2 max-w-lg text-xs text-white/75 md:mt-2.5 md:text-base">
              Food, salons, mechanics, coaching, resorts, gyms, grocery &amp; more — local offers from every business around you.
            </p>
            {/* Shop type chips — hidden on mobile to save space */}
            <div className="mt-3 hidden flex-wrap gap-2 md:flex">
              {['🍽️ Restaurants', '🔧 Mechanic', '📚 Education', '🏨 Resorts', '💇 Salons', '🛒 Grocery', '🏋️ Gyms', '💊 Pharmacy'].map((s) => (
                <span key={s} className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">{s}</span>
              ))}
            </div>

            {/* Stats bar — hidden on mobile */}
            <div className="mt-3 hidden flex-wrap gap-2 md:flex md:mt-5 md:gap-3">
              {[
                { label: 'Live Deals', value: allDeals.length, color: 'bg-white/15' },
                { label: 'Showing', value: deals.length, color: 'bg-white/15' },
                { label: feedMode.replace('-', ' '), value: null, color: 'bg-yellow-400/20 border border-yellow-400/30' },
              ].map((stat) => (
                <div key={stat.label} className={`rounded-xl ${stat.color} px-3.5 py-2 backdrop-blur-sm`}>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-white/70">{stat.label}</p>
                  <p className="mt-0.5 text-base font-extrabold text-white">
                    {stat.value !== null ? stat.value : <span className="capitalize text-sm">{feedMode.replace('-', ' ')}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Search ── */}
        <div className="relative mb-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-3.5 shadow-card backdrop-blur-xl transition-all duration-200 focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20">
            <Search size={18} className="shrink-0 text-slate-500" />
            <input
              list="deal-search-suggestions"
              className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600"
              style={{ border: 'none', padding: 0, boxShadow: 'none', borderRadius: 0, background: 'transparent' }}
              placeholder="Search deals, brands, areas…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <datalist id="deal-search-suggestions">
              {searchSuggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="rounded-lg bg-white/5 p-1 text-slate-500 transition hover:text-slate-300">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Business CTA Banner */}
        {!isBusiness && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-4"
          >
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-950/60 via-slate-900/80 to-violet-950/60">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-violet-500/8" />
              <div className="relative flex items-center gap-4 p-4 md:p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-xl shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                  🏪
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white md:text-base">Own a local business?</p>
                  <p className="mt-0.5 text-xs text-slate-400">Post deals for free · reach thousands nearby · no commission.</p>
                </div>
                <Link
                  href="/login"
                  className="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all duration-200 hover:opacity-90 hover:shadow-[0_0_28px_rgba(245,158,11,0.5)]"
                >
                  List Free →
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* Network error */}
        {networkIssue && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-400">
            <WifiOff size={13} className="shrink-0" />
            {networkIssue}
            <button onClick={fetchDeals} className="ml-auto font-semibold text-amber-300 underline">Retry</button>
          </div>
        )}

        {/* Onboarding */}
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/50 via-slate-900/80 to-fuchsia-950/30"
          >
            <div className="flex items-center justify-between border-b border-violet-500/10 px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-violet-400">Welcome to LocalDeals</p>
                <p className="mt-0.5 text-sm font-semibold text-white">Find the best deals around you</p>
              </div>
              <button
                onClick={() => { localStorage.setItem('ld_onboarding_done', '1'); setShowOnboarding(false); }}
                className="rounded-lg bg-white/5 p-1.5 text-slate-500 transition hover:text-slate-300"
              >
                <X size={14} />
              </button>
            </div>
            <div className="grid divide-y divide-white/5 md:grid-cols-3 md:divide-x md:divide-y-0">
              {[
                { icon: '📍', label: 'Find Nearby', desc: 'Enable Near Me to discover deals within your radius' },
                { icon: '🏷️', label: 'Browse Categories', desc: 'Filter by food, salons, gyms, and 20+ categories' },
                { icon: '❤️', label: 'Save & Personalise', desc: 'Save deals to get a personalised feed just for you' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-4">
                  <span className="mt-0.5 text-2xl leading-none">{step.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-white">{step.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-violet-500/10 px-4 py-2.5">
              <button
                onClick={() => { localStorage.setItem('ld_onboarding_done', '1'); setShowOnboarding(false); }}
                className="text-xs font-semibold text-violet-400 transition hover:text-violet-300"
              >
                Got it, let&apos;s explore →
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Sticky filter bar ── */}
        <div className="sticky top-[60px] z-20 mb-4 rounded-2xl border border-white/8 bg-slate-900/85 p-3 backdrop-blur-2xl">

          {/* Controls row */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {/* Near Me */}
            <button
              onClick={handleNearMe}
              disabled={geoStatus === 'loading'}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200 md:px-4 md:py-2.5 md:text-sm ${
                nearMeActive
                  ? 'border-violet-500/40 bg-violet-500/20 text-violet-300 shadow-neon-violet'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-400'
              } ${geoStatus === 'loading' ? 'cursor-wait opacity-60' : ''}`}
            >
              <LocateFixed size={14} className={geoStatus === 'loading' ? 'animate-spin' : ''} />
              {geoStatus === 'loading' ? 'Locating…' : nearMeActive ? 'Near Me ✓' : 'Near Me'}
              {geoStatus === 'ip-fallback' && nearMeActive && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/20">approx</span>
              )}
            </button>

            {/* Radius picker */}
            <AnimatePresence>
              {nearMeActive && (
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="relative">
                  <button
                    onClick={() => setShowRadiusPicker((p) => !p)}
                    className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-400 transition hover:bg-violet-500/20 md:py-2.5 md:text-sm"
                  >
                    <SlidersHorizontal size={13} />
                    {nearMeRadius} km
                  </button>
                  {showRadiusPicker && (
                    <div className="absolute left-0 top-full z-30 mt-1.5 min-w-[100px] overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-[0_16px_48px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                      {RADIUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setNearMeRadius(opt.value); setShowRadiusPicker(false); }}
                          className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-white/8 ${
                            nearMeRadius === opt.value ? 'font-bold text-violet-400' : 'text-slate-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active/Expired toggle */}
            <button
              onClick={() => setShowExpired((p) => !p)}
              className={`ml-auto flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200 md:px-4 md:py-2.5 md:text-sm ${
                showExpired
                  ? 'border-slate-500/30 bg-slate-500/20 text-slate-300'
                  : 'border-white/10 bg-white/5 text-slate-500 hover:border-white/20 hover:text-slate-300'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${showExpired ? 'bg-amber-400' : 'bg-emerald-400 shadow-neon-emerald'}`} />
              {showExpired ? 'Showing all' : 'Active only'}
            </button>
          </div>

          {/* Geo alerts */}
          <AnimatePresence>
            {geoStatus === 'ip-fallback' && nearMeActive && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-400"
              >
                <Info size={12} className="mt-0.5 shrink-0" />
                Using approximate location (GPS unavailable). Results may include deals slightly outside your area.
              </motion.div>
            )}
            {geoStatus === 'denied' && !nearMeActive && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mb-3 rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2.5 text-xs text-rose-400 space-y-1"
              >
                <p className="flex items-center gap-1.5 font-semibold"><AlertCircle size={12} /> Location permission denied</p>
                <p>Mac: System Settings → Privacy → Location Services → enable your browser.</p>
                <p>Chrome: Click lock icon → Site settings → Location → Allow.</p>
              </motion.div>
            )}
            {geoStatus === 'error' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mb-3 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2.5 text-xs text-rose-400"
              >
                <AlertCircle size={12} /> Could not detect location. Try again or use search.
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category pills */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORY_FILTERS.map((cat) => {
              const meta = cat.value === 'all' ? null : getCategoryMeta(cat.value);
              const active = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 md:px-4 md:py-2 md:text-sm ${
                    active
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-neon-violet scale-105'
                      : 'border border-white/8 bg-white/5 text-slate-400 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-400'
                  }`}
                >
                  {meta && <span className="text-sm leading-none">{meta.emoji}</span>}
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Feed mode tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FEED_MODES.map((mode) => (
              <button
                key={mode.key}
                onClick={() => setFeedMode(mode.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-200 md:px-3.5 md:py-2 md:text-sm ${
                  feedMode === mode.key
                    ? 'border-white/20 bg-white/15 text-white shadow-inner-top'
                    : 'border-white/8 bg-transparent text-slate-500 hover:border-white/15 hover:text-slate-300'
                }`}
              >
                <mode.icon size={13} /> {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ending today urgency strip */}
        {dealsEndingToday > 0 && !isFiltering && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setFeedMode('ending-soon')}
            className="mb-5 flex w-full items-center gap-3 overflow-hidden rounded-xl border border-rose-500/25 bg-gradient-to-r from-rose-950/60 to-amber-950/40 px-4 py-3 text-left transition-all duration-200 hover:border-rose-500/40 hover:bg-rose-500/5"
          >
            <span className="animate-pulse text-xl leading-none">🔥</span>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-white">
                <span className="text-rose-400">{dealsEndingToday} deal{dealsEndingToday !== 1 ? 's' : ''}</span> ending today
              </span>
              <span className="ml-2 text-xs text-slate-500">Don&apos;t miss out</span>
            </div>
            <span className="shrink-0 text-xs font-bold text-rose-400">View all →</span>
          </motion.button>
        )}

        {/* ── Spotlight — desktop only, saves mobile scroll ── */}
        {spotlightDeal && !isFiltering && (
          <Link href={`/deal/${spotlightDeal.id}`} className="mb-5 hidden md:block">
            <div className="group relative overflow-hidden rounded-2xl border border-violet-500/20 bg-slate-900/80 p-4 transition-all duration-300 hover:border-violet-500/40 hover:shadow-card-hover md:p-5">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 via-transparent to-fuchsia-600/5" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="min-w-0 flex items-center gap-3">
                  <span className="shrink-0 text-3xl">{getCategoryMeta(spotlightDeal.category).emoji}</span>
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-violet-400">✦ Spotlight Deal</p>
                    <p className="line-clamp-1 text-base font-bold text-white md:text-lg">{spotlightDeal.title}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {spotlightDeal.area || spotlightDeal.city || 'Location not set'} · {getCategoryLabel(spotlightDeal.category)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-amber-400">★ {spotlightDeal.rating?.toFixed(1) || '0.0'}</p>
                  <p className="text-xs text-slate-600">{spotlightDeal.rating_count || 0} reviews</p>
                  <ChevronRight size={16} className="ml-auto mt-1 text-slate-600 transition group-hover:text-violet-400" />
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* ── Deal count + view toggle ── */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs text-slate-500 md:text-sm">
            <span className="font-bold text-slate-200">{displayedDeals.length}</span> deals
            {nearMeActive && <span className="text-slate-600"> · within {nearMeRadius} km</span>}
            {searchQuery && <span className="text-slate-600"> · &quot;{searchQuery}&quot;</span>}
            {!showExpired && <span className="text-slate-600"> · active only</span>}
          </p>
          <div className="flex items-center gap-2">
            {isFiltering && (
              <button onClick={clearAll} className="text-xs font-semibold text-violet-400 transition hover:text-violet-300">
                Clear all
              </button>
            )}
            <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <List size={13} />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${viewMode === 'map' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <MapPinned size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Deals grid / Map / Empty ── */}
        {viewMode === 'map' ? (
          <div className="mb-6 overflow-hidden rounded-2xl border border-white/8 bg-slate-900/80">
            <div className="border-b border-white/8 p-4">
              <p className="font-bold text-white">Map Discovery</p>
              <p className="mt-0.5 text-xs text-slate-500">Explore nearby deals visually on an interactive map.</p>
            </div>
            <div className="p-4">
              <Link
                href="/map"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90"
              >
                <MapPinned size={14} /> Open Full Map
              </Link>
            </div>
          </div>
        ) : displayedDeals.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-24 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-slate-900/80">
              <Tag size={28} className="text-slate-600" />
            </div>
            <p className="text-lg font-bold text-slate-300">No deals found</p>
            <p className="mt-1 text-sm text-slate-600">
              {nearMeActive
                ? `No deals within ${nearMeRadius} km — try increasing the radius.`
                : 'Try another filter or search term.'}
            </p>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
            <AnimatePresence>
              {displayedDeals.map((deal) => (
                <motion.div
                  key={deal.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.22 }}
                >
                  <DealCard deal={deal} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Sections ── */}
        {!isFiltering && recentDeals.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-500" />
              <h2 className="text-sm font-bold text-white md:text-base">Recently Viewed</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentDeals.map((deal) => <DealCard key={`recent-${deal.id}`} deal={deal} />)}
            </div>
          </section>
        )}

        {!isFiltering && communityPicks.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500" />
              <h2 className="text-sm font-bold text-white md:text-base">Community Picks</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {communityPicks.map((deal) => <DealCard key={`pick-${deal.id}`} deal={deal} />)}
            </div>
          </section>
        )}

        {!isFiltering && endingSoonDeals.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-4 w-1 rounded-full bg-gradient-to-b from-rose-500 to-amber-500" />
              <h2 className="text-sm font-bold text-white md:text-base">Ending Soon</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {endingSoonDeals.map((deal) => {
                const meta = getCategoryMeta(deal.category);
                return (
                  <Link
                    key={`soon-${deal.id}`}
                    href={`/deal/${deal.id}`}
                    className="group rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 transition-all duration-200 hover:border-rose-500/40 hover:bg-rose-500/10"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg">{meta.emoji}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-400/70">{getCategoryLabel(deal.category)}</span>
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold text-white group-hover:text-rose-300">{deal.title}</p>
                    <p className="mt-1.5 text-xs font-medium text-rose-400">{getUrgencyLabel(deal.valid_till_date)}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </motion.div>
    </main>
  );
}
