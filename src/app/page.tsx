'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import DealCard from '@/app/components/DealCard';
import { CATEGORY_FILTERS, categoryMatchesFilter, getCategoryLabel, getCategoryMeta, normalizeCategory } from '@/app/lib/categories';
import { haversineKm, getDiscountPct } from '@/app/lib/deal-utils';
import InterestPicker, { ONBOARDED_KEY, SAVED_CATEGORIES_KEY } from '@/app/components/InterestPicker';
import { getTopCategoryAffinity } from '@/app/lib/growth';
import MiniDealCard from '@/app/components/MiniDealCard';
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
  Zap,
} from 'lucide-react';
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

const LAST_COORDS_KEY = 'ld_last_coords';

function readCachedCoords(): { lat: number; lng: number } | null {
  try {
    const raw = window.localStorage.getItem(LAST_COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') return { lat: parsed.lat, lng: parsed.lng };
    return null;
  } catch { return null; }
}

function cacheCoords(lat: number, lng: number) {
  try { window.localStorage.setItem(LAST_COORDS_KEY, JSON.stringify({ lat, lng })); } catch { /* best-effort */ }
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
  const [networkIssue, setNetworkIssue] = useState<string | null>(null);
  const [recentDeals, setRecentDeals] = useState<Deal[]>([]);
  const [isBusiness, setIsBusiness] = useState(false);
  const [affinityCategories, setAffinityCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

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
      setLoading(false);
      return;
    }
    setNetworkIssue(null);
    setAllDeals(data || []);
    setLoading(false);
  }, [showExpired]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const role = data.user.user_metadata?.role;
      if (role === 'business') setIsBusiness(true);
      getTopCategoryAffinity(data.user.id).then(setAffinityCategories);
    });
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchDeals(); }, [fetchDeals]);

  // First visit → interest picker; returning visitor with saved interests → personalized feed by default.
  useEffect(() => {
    try {
      const rawSaved = window.localStorage.getItem(SAVED_CATEGORIES_KEY);
      const savedCats = rawSaved ? (JSON.parse(rawSaved) as string[]) : [];
      if (savedCats.length) setFeedMode('personalized');
      if (!window.localStorage.getItem(ONBOARDED_KEY)) setShowOnboarding(true);
    } catch { /* localStorage unavailable */ }
  }, []);

  // Quiet location for distance badges: cached coords first, IP lookup as fallback.
  // Never activates the Near Me filter on its own.
  useEffect(() => {
    const cached = readCachedCoords();
    if (cached) { setUserLat(cached.lat); setUserLng(cached.lng); return; }
    let cancelled = false;
    getLocationByIP().then((loc) => {
      if (!loc || cancelled) return;
      setUserLat((prev) => (prev === null ? loc.lat : prev));
      setUserLng((prev) => (prev === null ? loc.lng : prev));
    });
    return () => { cancelled = true; };
  }, []);

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
    if (!isIP) cacheCoords(lat, lng);
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
      const rawSaved = typeof window !== 'undefined' ? window.localStorage.getItem(SAVED_CATEGORIES_KEY) : null;
      const favoriteCats = (rawSaved ? (JSON.parse(rawSaved) as string[]) : []).map((c) => normalizeCategory(c));
      const recentIdsRaw = typeof window !== 'undefined' ? window.localStorage.getItem('ld_recent_viewed') : null;
      const recentIds = recentIdsRaw ? (JSON.parse(recentIdsRaw) as number[]) : [];
      // Server-side behavior affinity (logged-in only), best category first —
      // rank-weighted so the strongest signal counts most.
      const affinityWeight = new Map(affinityCategories.map((c, i) => [c, Math.max(0, 10 - i)]));
      return sorted.sort((a, b) => {
        const boostDiff = boostFirst(a, b);
        if (boostDiff !== 0) return boostDiff;
        const aFav = favoriteCats.includes(normalizeCategory(a.category)) ? 1 : 0;
        const bFav = favoriteCats.includes(normalizeCategory(b.category)) ? 1 : 0;
        const aRecent = recentIds.includes(a.id) ? 1 : 0;
        const bRecent = recentIds.includes(b.id) ? 1 : 0;
        const aAffinity = affinityWeight.get(normalizeCategory(a.category)) || 0;
        const bAffinity = affinityWeight.get(normalizeCategory(b.category)) || 0;
        const aScore = aFav * 30 + aRecent * 15 + aAffinity * 4 + (a.rating || 0) * 5 + (a.clicks || 0) * 0.6 + (a.views || 0) * 0.2;
        const bScore = bFav * 30 + bRecent * 15 + bAffinity * 4 + (b.rating || 0) * 5 + (b.clicks || 0) * 0.6 + (b.views || 0) * 0.2;
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
  }, [deals, feedMode, affinityCategories]);

  const dealsEndingToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return allDeals.filter((d) => d.valid_till_date === today).length;
  }, [allDeals]);

  const hotDeals = useMemo(() =>
    [...allDeals].sort((a, b) => ((b.clicks || 0) + (b.views || 0)) - ((a.clicks || 0) + (a.views || 0))).slice(0, 12),
    [allDeals]);

  const topRatedStrip = useMemo(() =>
    [...allDeals].filter((d) => (d.rating || 0) >= 4).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 12),
    [allDeals]);

  const endingSoonStrip = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return [...allDeals]
      .filter((d) => d.valid_till_date && d.valid_till_date >= today)
      .sort((a, b) => new Date(a.valid_till_date!).getTime() - new Date(b.valid_till_date!).getTime())
      .slice(0, 12);
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

      {/* ── App Header ── */}
      <div className="mb-3 flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600">
            <Zap size={15} className="text-white" fill="white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">LocalDeals</span>
          {allDeals.length > 0 && (
            <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-400">
              {allDeals.length} live
            </span>
          )}
        </div>
        <button
          onClick={handleNearMe}
          disabled={geoStatus === 'loading'}
          aria-label={nearMeActive ? 'Disable near me filter' : 'Filter deals near me'}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
            nearMeActive
              ? 'border-violet-500/40 bg-violet-500/20 text-violet-300 shadow-neon-violet'
              : 'border-white/10 bg-white/5 text-slate-400 active:bg-white/10'
          } ${geoStatus === 'loading' ? 'cursor-wait opacity-60' : ''}`}
        >
          <LocateFixed size={13} className={geoStatus === 'loading' ? 'animate-spin' : ''} />
          {geoStatus === 'loading' ? 'Locating…' : nearMeActive ? 'Near Me ✓' : 'Near Me'}
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-3.5 backdrop-blur-xl transition-all duration-200 focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20">
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
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="rounded-full bg-white/5 p-1 text-slate-500 transition hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Category Bubbles (Swiggy-style icon grid) ── */}
      <div className="relative -mx-4 mb-5">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-3 px-4 pb-1" style={{ width: 'max-content' }}>
            {CATEGORY_FILTERS.map((cat) => {
              const meta = cat.value === 'all' ? { emoji: '🌟' } : getCategoryMeta(cat.value);
              const active = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  aria-label={cat.label}
                  aria-pressed={active}
                  className="flex shrink-0 flex-col items-center gap-1.5 select-none transition-transform duration-100 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded-2xl"
                >
                  <div className={`flex h-[60px] w-[60px] items-center justify-center rounded-2xl text-2xl transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-neon-violet scale-110'
                      : 'border border-white/8 bg-slate-800/80'
                  }`}>
                    {meta?.emoji || '🌟'}
                  </div>
                  <span className={`w-[60px] truncate text-center text-[11px] font-bold transition-colors duration-200 ${
                    active ? 'text-violet-400' : 'text-slate-500'
                  }`}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* right-fade scroll hint */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-slate-950 to-transparent" />
      </div>

      {/* Network error */}
      {networkIssue && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-400">
          <WifiOff size={13} className="shrink-0" />
          {networkIssue}
          <button onClick={fetchDeals} className="ml-auto rounded-full font-semibold text-amber-300 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">Retry</button>
        </div>
      )}

      {/* Geo alerts */}
      <AnimatePresence>
        {geoStatus === 'ip-fallback' && nearMeActive && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-400"
          >
            <Info size={12} className="mt-0.5 shrink-0" />
            Using approximate location (GPS unavailable). Results may include deals slightly outside your area.
          </motion.div>
        )}
        {geoStatus === 'denied' && !nearMeActive && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mb-3 rounded-2xl border border-rose-500/20 bg-rose-500/8 px-3 py-2.5 text-xs text-rose-400 space-y-1"
          >
            <p className="flex items-center gap-1.5 font-semibold"><AlertCircle size={12} /> Location permission denied</p>
            <p>Chrome: Click lock icon → Site settings → Location → Allow.</p>
          </motion.div>
        )}
        {geoStatus === 'error' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mb-3 flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/8 px-3 py-2.5 text-xs text-rose-400"
          >
            <AlertCircle size={12} /> Could not detect location. Try again or use search.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Discovery strips (hidden when filtering) ── */}
      {!isFiltering && loading && (
        <div className="mb-5 space-y-5">
          <div className="h-52 animate-pulse rounded-2xl border border-white/8 bg-slate-800/60" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 w-40 shrink-0 animate-pulse rounded-2xl border border-white/8 bg-slate-800/60" />
            ))}
          </div>
        </div>
      )}
      {!isFiltering && !loading && (
        <>
          {/* Featured Deal — full-width hero card */}
          {hotDeals[0] && (
            <div className="mb-5">
              <Link
                href={`/deal/${hotDeals[0].id}`}
                className="card-press block overflow-hidden rounded-2xl border border-white/8 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
              >
                <div className="relative h-52 bg-slate-800">
                  {hotDeals[0].image ? (
                    <img src={hotDeals[0].image} alt={hotDeals[0].title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-violet-900/80 to-fuchsia-900/80 text-8xl">
                      {getCategoryMeta(hotDeals[0].category).emoji}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute left-3 top-3 flex items-center gap-1 rounded-lg bg-rose-500/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-extrabold text-white">
                    🔥 Featured
                  </div>
                  {discountPct(hotDeals[0]) !== null && (
                    <div className="absolute right-3 top-3 rounded-lg bg-emerald-500/90 backdrop-blur-sm px-2.5 py-1 text-[11px] font-extrabold text-white">
                      {discountPct(hotDeals[0])}% OFF
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-violet-300">
                      {getCategoryLabel(hotDeals[0].category)}{hotDeals[0].area || hotDeals[0].city ? ` · ${hotDeals[0].area || hotDeals[0].city}` : ''}
                    </p>
                    <p className="text-lg font-black leading-snug text-white line-clamp-2">{hotDeals[0].title}</p>
                    <div className="mt-2 flex items-center gap-3">
                      {hotDeals[0].offer_price && (
                        <span className="text-sm font-extrabold text-yellow-300">{hotDeals[0].offer_price}</span>
                      )}
                      {hotDeals[0].original_price && (
                        <span className="text-xs text-slate-400 line-through">{hotDeals[0].original_price}</span>
                      )}
                      {(hotDeals[0].rating || 0) > 0 && (
                        <span className="ml-auto text-sm font-bold text-amber-400">★ {hotDeals[0].rating?.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* 🔥 Hot Today */}
          {hotDeals.length > 1 && <StripSection title="🔥 Hot Today" deals={hotDeals.slice(1, 11)} userLat={userLat} userLng={userLng} />}

          {/* ⭐ Top Rated */}
          {topRatedStrip.length > 0 && <StripSection title="⭐ Top Rated" deals={topRatedStrip} userLat={userLat} userLng={userLng} />}

          {/* ⏰ Ending Soon */}
          {endingSoonStrip.length > 0 && <StripSection title="⏰ Ending Soon" deals={endingSoonStrip} urgency userLat={userLat} userLng={userLng} />}

          {/* Ending today urgency banner */}
          {dealsEndingToday > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={() => setFeedMode('ending-soon')}
              className="mb-5 flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-rose-500/25 bg-slate-900/80 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
            >
              <span className="animate-pulse text-xl leading-none">🔥</span>
              <span className="flex-1 text-sm font-semibold text-white">
                <span className="text-rose-400">{dealsEndingToday} deal{dealsEndingToday !== 1 ? 's' : ''}</span> ending today
              </span>
              <span className="shrink-0 text-xs font-bold text-rose-400">View all →</span>
            </motion.button>
          )}

          {/* 👀 Recently Viewed */}
          {recentDeals.length > 0 && <StripSection title="👀 Recently Viewed" deals={recentDeals} userLat={userLat} userLng={userLng} />}
        </>
      )}

      {/* ── All Deals heading ── */}
      <div className="mb-3 mt-6 flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-violet-500" />
        <h2 className="text-lg font-extrabold tracking-tight text-white">All Deals</h2>
        {nearMeActive && <span className="text-xs text-slate-500">· within {nearMeRadius} km</span>}
        {searchQuery && <span className="text-xs text-slate-500">· &quot;{searchQuery}&quot;</span>}
        <span className="ml-auto text-xs font-semibold text-slate-400">{displayedDeals.length} results</span>
      </div>

      {/* Feed mode tabs */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FEED_MODES.map((mode) => (
          <button
            key={mode.key}
            onClick={() => setFeedMode(mode.key)}
            aria-pressed={feedMode === mode.key}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
              feedMode === mode.key
                ? 'border-white/20 bg-white/15 text-white'
                : 'border-white/8 bg-transparent text-slate-500 hover:border-white/15 hover:text-slate-300'
            }`}
          >
            <mode.icon size={13} /> {mode.label}
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AnimatePresence>
          {nearMeActive && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="relative">
              <button
                onClick={() => setShowRadiusPicker((p) => !p)}
                aria-expanded={showRadiusPicker}
                className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-400 transition hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
              >
                <SlidersHorizontal size={13} />
                {nearMeRadius} km
              </button>
              {showRadiusPicker && (
                <div className="absolute left-0 top-full z-30 mt-1.5 min-w-[100px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-card backdrop-blur-2xl">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setNearMeRadius(opt.value); setShowRadiusPicker(false); }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/40 ${
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

        <button
          onClick={() => setShowExpired((p) => !p)}
          aria-pressed={showExpired}
          className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
            showExpired
              ? 'border-slate-500/30 bg-slate-500/20 text-slate-300'
              : 'border-white/10 bg-white/5 text-slate-500 hover:border-white/20 hover:text-slate-300'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${showExpired ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          {showExpired ? 'Showing all' : 'Active only'}
        </button>

        {isFiltering && (
          <button onClick={clearAll} className="rounded-full text-sm font-semibold text-violet-400 transition hover:text-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
            Clear all
          </button>
        )}

        <div className="ml-auto flex items-center gap-1 rounded-full border border-white/8 bg-white/5 p-1">
          <button
            onClick={() => setViewMode('list')}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            className={`rounded-full px-2.5 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${viewMode === 'list' ? 'bg-white/15 text-white' : 'text-slate-500'}`}
          >
            <List size={13} />
          </button>
          <button
            onClick={() => setViewMode('map')}
            aria-label="Map view"
            aria-pressed={viewMode === 'map'}
            className={`rounded-full px-2.5 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${viewMode === 'map' ? 'bg-white/15 text-white' : 'text-slate-500'}`}
          >
            <MapPinned size={13} />
          </button>
        </div>
      </div>

      {/* ── Deals / Map / Empty ── */}
      {viewMode === 'map' ? (
        <div className="mb-6 overflow-hidden rounded-2xl border border-white/8 bg-slate-900/80">
          <div className="border-b border-white/8 p-4">
            <p className="font-bold text-white">Map Discovery</p>
            <p className="mt-0.5 text-xs text-slate-500">Explore nearby deals on an interactive map.</p>
          </div>
          <div className="p-4">
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
            >
              <MapPinned size={14} /> Open Full Map
            </Link>
          </div>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : displayedDeals.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="py-24 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-slate-900/80">
            <Tag size={28} className="text-slate-500" />
          </div>
          <p className="text-lg font-bold text-slate-300">No deals found</p>
          <p className="mt-1 text-sm text-slate-500">
            {nearMeActive
              ? `No deals within ${nearMeRadius} km — try increasing the radius.`
              : 'Try another filter or search term.'}
          </p>
          {isFiltering && (
            <button
              onClick={clearAll}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
            >
              Clear filters
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5 xl:grid-cols-3">
          <AnimatePresence>
            {displayedDeals.map((deal, index) => (
              <motion.div
                key={deal.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(index, 10) * 0.05 }}
              >
                <DealCard deal={deal} userLat={userLat} userLng={userLng} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Business CTA (bottom) ── */}
      {!isBusiness && (
        <div className="mt-10">
          <Link
            href="/login"
            className="card-press flex items-center gap-4 rounded-2xl border border-amber-500/25 bg-slate-900/80 px-5 py-4 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
          >
            <span className="text-2xl leading-none">🏪</span>
            <div>
              <p className="text-sm font-extrabold text-amber-400">List your business deals free</p>
              <p className="text-xs text-slate-500">Join local businesses on LocalDeals →</p>
            </div>
            <ChevronRight size={16} className="ml-auto shrink-0 text-amber-500/60" />
          </Link>
        </div>
      )}

      {/* ── First-visit interest picker ── */}
      {showOnboarding && (
        <InterestPicker
          onDone={(picked) => {
            setShowOnboarding(false);
            if (picked.length) setFeedMode('personalized');
          }}
        />
      )}

    </main>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-white/8 bg-slate-900/95">
      <div className="h-48 bg-slate-800/70 md:h-52" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 rounded-lg bg-slate-800/70" />
        <div className="h-3 w-full rounded-lg bg-slate-800/50" />
        <div className="h-3 w-1/2 rounded-lg bg-slate-800/50" />
        <div className="flex gap-2 pt-1">
          <div className="h-7 w-20 rounded-lg bg-slate-800/50" />
          <div className="h-7 w-20 rounded-lg bg-slate-800/50" />
        </div>
      </div>
    </div>
  );
}

function discountPct(deal: Deal): number | null {
  return getDiscountPct(deal.offer_price, deal.original_price);
}

function StripSection({ title, deals, urgency = false, userLat, userLng }: {
  title: string;
  deals: Deal[];
  urgency?: boolean;
  userLat?: number | null;
  userLng?: number | null;
}) {
  if (!deals.length) return null;
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-extrabold tracking-tight text-white">{title}</h2>
        <span className="text-xs text-slate-500">{deals.length} deals</span>
      </div>
      <div className="relative -mx-4">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-3 px-4" style={{ width: 'max-content' }}>
            {deals.map((deal, index) => (
              <motion.div
                key={deal.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(index, 10) * 0.05 }}
              >
                <MiniDealCard deal={deal} userLat={userLat} userLng={userLng} />
              </motion.div>
            ))}
            <div className="w-2 shrink-0" />
          </div>
        </div>
        <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-slate-950 to-transparent" />
      </div>
      {urgency && (
        <p className="mt-2 text-[11px] text-rose-400/70">⏳ Grab these before they&apos;re gone</p>
      )}
    </section>
  );
}
