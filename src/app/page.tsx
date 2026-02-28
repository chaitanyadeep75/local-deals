'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import DealCard from '@/app/components/DealCard';
import { CATEGORY_FILTERS, categoryMatchesFilter, getCategoryLabel } from '@/app/lib/categories';
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
};

type FeedMode = 'for-you' | 'top-rated' | 'ending-soon' | 'trending';
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

export default function HomePage() {
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showExpired, setShowExpired] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<FeedMode>('for-you');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showOnboarding, setShowOnboarding] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('ld_onboarding_done') !== '1'
  );
  const [networkIssue, setNetworkIssue] = useState<string | null>(null);
  const [recentDeals, setRecentDeals] = useState<Deal[]>([]);

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

    // Backward-compatible fallback when new migration (status column) is not applied yet.
    if (error && (error.code === '42703' || String(error.message || '').toLowerCase().includes('status'))) {
      ({ data, error } = await runQuery(false));
    }

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('fetch') || msg.includes('network')) {
        setNetworkIssue('Network issue while loading deals. Please retry.');
      } else {
        setNetworkIssue('Could not load deals right now. Please retry.');
      }
      setAllDeals([]);
      return;
    }

    setNetworkIssue(null);
    setAllDeals(data || []);
  }, [showExpired]);

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
    setUserLat(lat);
    setUserLng(lng);
    setNearMeActive(true);
    setGeoStatus(isIP ? 'ip-fallback' : 'active');
  };

  const tryIPFallback = async () => {
    const ipLoc = await getLocationByIP();
    if (ipLoc) activateWithCoords(ipLoc.lat, ipLoc.lng, true);
    else setGeoStatus('error');
  };

  const handleNearMe = () => {
    if (nearMeActive) {
      setNearMeActive(false);
      setGeoStatus('idle');
      return;
    }

    if (userLat && userLng) {
      setNearMeActive(true);
      setGeoStatus(geoStatus === 'ip-fallback' ? 'ip-fallback' : 'active');
      return;
    }

    setGeoStatus('loading');

    if (!navigator.geolocation) {
      tryIPFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => activateWithCoords(pos.coords.latitude, pos.coords.longitude),
      async (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus('denied');
          const ipLoc = await getLocationByIP();
          if (ipLoc) activateWithCoords(ipLoc.lat, ipLoc.lng, true);
        } else {
          await tryIPFallback();
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const clearAll = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setNearMeActive(false);
    setGeoStatus('idle');
    setFeedMode('for-you');
  };

  const isFiltering = searchQuery.trim().length > 0 || nearMeActive || selectedCategory !== 'all';

  const displayedDeals = useMemo(() => {
    const sorted = [...deals];
    if (feedMode === 'top-rated') {
      return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.rating_count || 0) - (a.rating_count || 0));
    }
    if (feedMode === 'ending-soon') {
      return sorted.sort((a, b) => {
        const ad = a.valid_till_date ? new Date(a.valid_till_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.valid_till_date ? new Date(b.valid_till_date).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });
    }
    if (feedMode === 'trending') {
      return sorted.sort((a, b) => ((b.clicks || 0) + (b.views || 0)) - ((a.clicks || 0) + (a.views || 0)));
    }
    return sorted;
  }, [deals, feedMode]);

  const spotlightDeal = displayedDeals[0] || null;
  const endingSoonDeals = displayedDeals
    .filter((d) => {
      const label = getUrgencyLabel(d.valid_till_date);
      return label && label !== 'Expired';
    })
    .slice(0, 4);
  const communityPicks = [...displayedDeals]
    .sort((a, b) => ((b.rating_count || 0) + (b.clicks || 0)) - ((a.rating_count || 0) + (a.clicks || 0)))
    .slice(0, 6);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#e0e7ff_0%,_#f8fafc_38%,_#eef2ff_100%)] px-1 pb-16 md:px-4">
      <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
      <div className="pointer-events-none absolute top-12 right-0 h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <div className="relative mb-4 mt-3 overflow-hidden rounded-[1.6rem] border border-indigo-200/70 shadow-[0_18px_45px_-20px_rgba(79,70,229,0.45)] md:mb-6 md:mt-5 md:rounded-[2rem]">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 opacity-95" />
          <div className="relative p-5 text-white md:p-9">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs">
              <Sparkles size={12} /> Daily local picks for you
            </p>
            <h1 className="text-2xl font-black tracking-tight md:text-4xl">Find Better Deals Around You</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/90 md:text-base">Browse smarter, save faster, and discover new local favorites.</p>
            <div className="mt-4 grid max-w-md grid-cols-3 gap-2.5 md:mt-5 md:gap-3">
              <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
                <p className="text-xs text-white/80">Live Deals</p>
                <p className="text-lg font-bold md:text-xl">{allDeals.length}</p>
              </div>
              <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
                <p className="text-xs text-white/80">Filtered</p>
                <p className="text-lg font-bold md:text-xl">{deals.length}</p>
              </div>
              <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
                <p className="text-xs text-white/80">Mode</p>
                <p className="text-sm font-semibold capitalize">{feedMode.replace('-', ' ')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mb-3 md:mb-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-lg shadow-indigo-100/30 backdrop-blur focus-within:ring-2 focus-within:ring-indigo-400 transition">
            <Search size={20} className="text-gray-400 shrink-0" />
            <input
              className="flex-1 outline-none text-sm bg-transparent placeholder-gray-400"
              style={{ border: 'none', padding: 0, boxShadow: 'none', borderRadius: 0 }}
              placeholder="Search deals, brands, areas…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        {networkIssue && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <WifiOff size={13} />
            {networkIssue}
            <button onClick={fetchDeals} className="ml-auto font-semibold text-amber-800 underline">Retry</button>
          </div>
        )}
        {showOnboarding && (
          <div className="mb-3 rounded-2xl border border-indigo-200 bg-white/90 p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Quick start</p>
            <p className="mt-1 text-sm font-medium text-slate-800">Use LocalDeals in 3 steps</p>
            <div className="mt-2 grid gap-1.5 text-xs text-slate-600 md:grid-cols-3">
              <p>1. Enable <strong>Near Me</strong></p>
              <p>2. Select categories you like</p>
              <p>3. Save one deal to personalize feed</p>
            </div>
            <button
              onClick={() => {
                localStorage.setItem('ld_onboarding_done', '1');
                setShowOnboarding(false);
              }}
              className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
            >
              Got it
            </button>
          </div>
        )}

        <div className="sticky top-[64px] z-20 mb-3 rounded-2xl border border-white/70 bg-white/70 p-2 backdrop-blur md:mb-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 md:mb-4 md:gap-3">
          <button
            onClick={handleNearMe}
            disabled={geoStatus === 'loading'}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all md:px-4 md:py-2.5 md:text-sm
              ${nearMeActive
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200'
                : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:text-indigo-700'
              } ${geoStatus === 'loading' ? 'opacity-70 cursor-wait' : ''}`}
          >
            <LocateFixed size={16} className={geoStatus === 'loading' ? 'animate-spin' : ''} />
            {geoStatus === 'loading' ? 'Locating…' : nearMeActive ? 'Near Me ✓' : 'Near Me'}
            {geoStatus === 'ip-fallback' && nearMeActive && (
              <span className="text-xs bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full ml-1">approx</span>
            )}
          </button>

          <AnimatePresence>
            {nearMeActive && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="relative">
                <button
                  onClick={() => setShowRadiusPicker((p) => !p)}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 md:py-2.5 md:text-sm"
                >
                  <SlidersHorizontal size={14} />
                  {nearMeRadius} km
                </button>
                {showRadiusPicker && (
                  <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-30 min-w-[110px]">
                    {RADIUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setNearMeRadius(opt.value); setShowRadiusPicker(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition
                          ${nearMeRadius === opt.value ? 'text-indigo-700 font-semibold bg-indigo-50' : 'text-gray-700'}`}
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
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all md:ml-auto md:px-4 md:py-2.5 md:text-sm
              ${showExpired ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
          >
            <span className={`w-2 h-2 rounded-full ${showExpired ? 'bg-yellow-400' : 'bg-green-400'}`} />
            {showExpired ? 'Showing all' : 'Active only'}
          </button>
        </div>

        <AnimatePresence>
          {geoStatus === 'ip-fallback' && nearMeActive && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4">
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>Using approximate location (GPS unavailable). Results may include deals slightly outside your area.</span>
            </motion.div>
          )}

          {geoStatus === 'denied' && !nearMeActive && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4 space-y-1">
              <p className="flex items-center gap-1.5 text-red-700 font-medium"><AlertCircle size={13} /> Location permission denied</p>
              <p className="text-red-600"><strong>Mac:</strong> System Settings → Privacy & Security → Location Services → enable Chrome.</p>
              <p className="text-red-600"><strong>Chrome:</strong> Click lock icon → Site settings → Location → Allow.</p>
            </motion.div>
          )}

          {geoStatus === 'error' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
              <AlertCircle size={13} /> Could not detect location. Try again or use search.
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-2 flex gap-2 overflow-x-auto pb-3 md:mb-3 md:gap-3">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 md:px-5 md:py-2 md:text-sm
                ${selectedCategory === cat.value
                  ? 'scale-105 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-lg'
                  : 'bg-white/90 text-gray-700 shadow hover:bg-indigo-50'
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="mb-2 flex gap-2 overflow-x-auto pb-3 md:pb-4">
          {[
            { key: 'for-you' as const, label: 'For You', icon: Sparkles },
            { key: 'top-rated' as const, label: 'Top Rated', icon: Trophy },
            { key: 'ending-soon' as const, label: 'Ending Soon', icon: Clock3 },
            { key: 'trending' as const, label: 'Trending', icon: Flame },
          ].map((mode) => (
            <button
              key={mode.key}
              onClick={() => setFeedMode(mode.key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs transition md:px-3.5 md:py-2 md:text-sm
                ${feedMode === mode.key ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white/90 text-gray-700 hover:border-gray-300'}`}
            >
              <mode.icon size={14} /> {mode.label}
            </button>
          ))}
        </div>
        </div>

        {spotlightDeal && !isFiltering && (
          <div className="mb-4 rounded-2xl border border-indigo-100/70 bg-white/90 p-3.5 shadow-sm backdrop-blur md:mb-5 md:p-4">
            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">Spotlight</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-bold leading-snug text-gray-900 md:text-base">{spotlightDeal.title}</p>
                <p className="truncate text-xs text-gray-500">{spotlightDeal.area || spotlightDeal.city || 'Location not set'} · {getCategoryLabel(spotlightDeal.category)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm text-amber-500 font-semibold">★ {spotlightDeal.rating?.toFixed(1) || '0.0'}</p>
                <p className="text-xs text-gray-400">{spotlightDeal.rating_count || 0} reviews</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between md:mb-4">
          <p className="text-xs text-gray-500 md:text-sm">
            <span className="font-semibold text-gray-800">{displayedDeals.length}</span> deals
            {nearMeActive && ` within ${nearMeRadius} km`}
            {searchQuery && ` · "${searchQuery}"`}
            {!showExpired && ' · expired hidden'}
          </p>
          {isFiltering && (
            <button onClick={clearAll} className="text-xs font-medium text-indigo-600 hover:underline">Clear</button>
          )}
        </div>
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            <List size={13} /> List
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${viewMode === 'map' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            <MapPinned size={13} /> Map
          </button>
        </div>

        {viewMode === 'map' ? (
          <div className="mb-6 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Map discovery</p>
            <p className="mt-1 text-xs text-slate-500">Open full map and explore nearby pins visually.</p>
            <Link href="/map" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">
              Open full map <MapPinned size={12} />
            </Link>
          </div>
        ) : displayedDeals.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🏷️</p>
            <p className="text-lg font-medium text-gray-600">No deals found</p>
            <p className="text-sm mt-1">
              {nearMeActive ? `No deals within ${nearMeRadius} km — try increasing the radius.` : 'Try another filter or search term.'}
            </p>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
            <AnimatePresence>
              {displayedDeals.map((deal) => (
                <motion.div
                  key={deal.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  <DealCard deal={deal} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        {!isFiltering && recentDeals.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-800">Recently viewed</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentDeals.map((deal) => <DealCard key={`recent-${deal.id}`} deal={deal} />)}
            </div>
          </section>
        )}
        {!isFiltering && communityPicks.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-800">Community picks</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {communityPicks.map((deal) => <DealCard key={`pick-${deal.id}`} deal={deal} />)}
            </div>
          </section>
        )}
        {!isFiltering && endingSoonDeals.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-800">Ending soon</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {endingSoonDeals.map((deal) => (
                <Link key={`soon-${deal.id}`} href={`/deal/${deal.id}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p className="line-clamp-1 font-semibold text-slate-800">{deal.title}</p>
                  <p className="mt-1 text-xs text-amber-700">{getUrgencyLabel(deal.valid_till_date)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </motion.div>
    </main>
  );
}
