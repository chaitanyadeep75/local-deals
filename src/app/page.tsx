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
} from 'lucide-react';

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
};

type FeedMode = 'for-you' | 'top-rated' | 'ending-soon' | 'trending';

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
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showExpired, setShowExpired] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<FeedMode>('for-you');

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [nearMeActive, setNearMeActive] = useState(false);
  const [nearMeRadius, setNearMeRadius] = useState(5);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);

  const fetchDeals = useCallback(async () => {
    let query = supabase.from('deals').select('*');
    if (!showExpired) {
      const today = new Date().toISOString().split('T')[0];
      query = query.or(`valid_till_date.is.null,valid_till_date.gte.${today}`);
    }
    const { data } = await query.order('created_at', { ascending: false });
    setAllDeals(data || []);
  }, [showExpired]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  useEffect(() => {
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

    setDeals(filtered);
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-6 pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <div className="relative rounded-3xl overflow-hidden mb-6 mt-6 shadow-xl border border-indigo-200/50">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 opacity-95" />
          <div className="relative p-8 text-white">
            <p className="inline-flex items-center gap-2 text-xs bg-white/20 rounded-full px-3 py-1 mb-3">
              <Sparkles size={12} /> Daily local picks for you
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Find Better Deals Around You</h1>
            <p className="mt-2 text-white/90">Browse smarter, save faster, and discover new local favorites.</p>
            <div className="mt-5 grid grid-cols-3 gap-3 max-w-md">
              <div className="bg-white/15 rounded-xl p-3 backdrop-blur">
                <p className="text-xs text-white/80">Live Deals</p>
                <p className="text-xl font-bold">{allDeals.length}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-3 backdrop-blur">
                <p className="text-xs text-white/80">Filtered</p>
                <p className="text-xl font-bold">{deals.length}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-3 backdrop-blur">
                <p className="text-xs text-white/80">Mode</p>
                <p className="text-sm font-semibold capitalize">{feedMode.replace('-', ' ')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mb-4">
          <div className="flex items-center gap-3 bg-white rounded-2xl shadow-md px-4 py-3 border border-gray-100 focus-within:ring-2 focus-within:ring-indigo-400 transition">
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

        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <button
            onClick={handleNearMe}
            disabled={geoStatus === 'loading'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all
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
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-indigo-300 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-50"
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
            className={`ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all
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

        <div className="flex gap-3 overflow-x-auto pb-3 mb-3">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200
                ${selectedCategory === cat.value
                  ? 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-indigo-50 shadow'
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
          {[
            { key: 'for-you' as const, label: 'For You', icon: Sparkles },
            { key: 'top-rated' as const, label: 'Top Rated', icon: Trophy },
            { key: 'ending-soon' as const, label: 'Ending Soon', icon: Clock3 },
            { key: 'trending' as const, label: 'Trending', icon: Flame },
          ].map((mode) => (
            <button
              key={mode.key}
              onClick={() => setFeedMode(mode.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm whitespace-nowrap border transition
                ${feedMode === mode.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
            >
              <mode.icon size={14} /> {mode.label}
            </button>
          ))}
        </div>

        {spotlightDeal && !isFiltering && (
          <div className="mb-5 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">Spotlight</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{spotlightDeal.title}</p>
                <p className="text-xs text-gray-500 truncate">{spotlightDeal.area || spotlightDeal.city || 'Location not set'} · {getCategoryLabel(spotlightDeal.category)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm text-amber-500 font-semibold">★ {spotlightDeal.rating?.toFixed(1) || '0.0'}</p>
                <p className="text-xs text-gray-400">{spotlightDeal.rating_count || 0} reviews</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{displayedDeals.length}</span> deals
            {nearMeActive && ` within ${nearMeRadius} km`}
            {searchQuery && ` · "${searchQuery}"`}
            {!showExpired && ' · expired hidden'}
          </p>
          {isFiltering && (
            <button onClick={clearAll} className="text-xs text-indigo-600 hover:underline font-medium">Clear filters</button>
          )}
        </div>

        {displayedDeals.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🏷️</p>
            <p className="text-lg font-medium text-gray-600">No deals found</p>
            <p className="text-sm mt-1">
              {nearMeActive ? `No deals within ${nearMeRadius} km — try increasing the radius.` : 'Try another filter or search term.'}
            </p>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </motion.div>
    </main>
  );
}
