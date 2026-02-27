'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import DealCard from '@/app/components/DealCard';
import { CATEGORY_FILTERS, categoryMatchesFilter, getCategoryLabel } from '@/app/lib/categories';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LocateFixed, X, SlidersHorizontal, AlertCircle, Info } from 'lucide-react';

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

// IP-based location fallback
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

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [nearMeActive, setNearMeActive] = useState(false);
  const [nearMeRadius, setNearMeRadius] = useState(5);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);

  /* ── FETCH ── */
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

  /* ── FILTER (client-side) ── */
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

  /* ── GEOLOCATION WITH IP FALLBACK ── */
  const activateWithCoords = (lat: number, lng: number, isIP = false) => {
    setUserLat(lat);
    setUserLng(lng);
    setNearMeActive(true);
    setGeoStatus(isIP ? 'ip-fallback' : 'active');
  };

  const tryIPFallback = async () => {
    const ipLoc = await getLocationByIP();
    if (ipLoc) {
      activateWithCoords(ipLoc.lat, ipLoc.lng, true);
    } else {
      setGeoStatus('error');
    }
  };

  const handleNearMe = () => {
    // Toggle off
    if (nearMeActive) {
      setNearMeActive(false);
      setGeoStatus('idle');
      return;
    }

    // Already have coords from before
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
          // Still try IP as fallback even when denied
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
    setSearchQuery('');
    setNearMeActive(false);
    setGeoStatus('idle');
  };

  const isFiltering = searchQuery || nearMeActive;

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 pb-16">
      <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>

        {/* HERO */}
        <div className="relative rounded-3xl overflow-hidden mb-8 mt-6 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 opacity-95" />
          <div className="relative p-10 text-white">
            <h1 className="text-4xl font-extrabold tracking-tight">Discover Amazing Local Deals ✨</h1>
            <p className="mt-3 text-white/90 text-lg">Save more. Explore more. Experience more.</p>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative mb-4">
          <div className="flex items-center gap-3 bg-white rounded-2xl shadow-md px-4 py-3 border border-gray-100 focus-within:ring-2 focus-within:ring-purple-400 transition">
            <Search size={20} className="text-gray-400 shrink-0" />
            <input
              className="flex-1 outline-none text-sm bg-transparent placeholder-gray-400"
              style={{ border: 'none', padding: 0, boxShadow: 'none', borderRadius: 0 }}
              placeholder="Search deals, restaurants, areas…"
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

        {/* CONTROLS ROW */}
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          {/* Near Me */}
          <button
            onClick={handleNearMe}
            disabled={geoStatus === 'loading'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all
              ${nearMeActive
                ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-200'
                : 'bg-white text-gray-700 border-gray-200 hover:border-purple-400 hover:text-purple-700'
              } ${geoStatus === 'loading' ? 'opacity-70 cursor-wait' : ''}`}
          >
            <LocateFixed size={16} className={geoStatus === 'loading' ? 'animate-spin' : ''} />
            {geoStatus === 'loading' ? 'Locating…' : nearMeActive ? '📡 Near Me ✓' : 'Near Me'}
            {geoStatus === 'ip-fallback' && nearMeActive && (
              <span className="text-xs bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full ml-1">approx</span>
            )}
          </button>

          {/* Radius — only when near me active */}
          <AnimatePresence>
            {nearMeActive && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="relative"
              >
                <button
                  onClick={() => setShowRadiusPicker((p) => !p)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-purple-300 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-50"
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
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 transition
                          ${nearMeRadius === opt.value ? 'text-purple-700 font-semibold bg-purple-50' : 'text-gray-700'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expired toggle */}
          <button
            onClick={() => setShowExpired((p) => !p)}
            className={`ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all
              ${showExpired ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
          >
            <span className={`w-2 h-2 rounded-full ${showExpired ? 'bg-yellow-400' : 'bg-green-400'}`} />
            {showExpired ? 'Showing all' : 'Active only'}
          </button>
        </div>

        {/* GEO STATUS BANNERS */}
        <AnimatePresence>
          {geoStatus === 'ip-fallback' && nearMeActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4"
            >
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>
                Using approximate location (GPS unavailable). Results may include deals slightly outside your area.
              </span>
            </motion.div>
          )}

          {geoStatus === 'denied' && !nearMeActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4 space-y-1"
            >
              <p className="flex items-center gap-1.5 text-red-700 font-medium">
                <AlertCircle size={13} /> Location permission denied
              </p>
              <p className="text-red-600">
                <strong>Mac:</strong> System Settings → Privacy & Security → Location Services → enable Chrome.
              </p>
              <p className="text-red-600">
                <strong>Chrome:</strong> Click 🔒 in address bar → Site settings → Location → Allow.
              </p>
            </motion.div>
          )}

          {geoStatus === 'error' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4"
            >
              <AlertCircle size={13} />
              Could not detect location. Try again or use the search bar.
            </motion.div>
          )}
        </AnimatePresence>

        {/* CATEGORY PILLS */}
        <div className="flex gap-3 overflow-x-auto pb-3 mb-5">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300
                ${selectedCategory === cat.value
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-purple-100 hover:scale-105 shadow'
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* RESULT SUMMARY */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{deals.length}</span> deal{deals.length !== 1 ? 's' : ''} found
            {nearMeActive && ` within ${nearMeRadius} km`}
            {searchQuery && ` · "${searchQuery}"`}
            {!showExpired && ' · expired hidden'}
          </p>
          {isFiltering && (
            <button onClick={clearAll} className="text-xs text-purple-600 hover:underline font-medium">
              Clear filters
            </button>
          )}
        </div>

        {/* DEAL GRID */}
        {deals.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 text-gray-400">
            <p className="text-5xl mb-4">🏷️</p>
            <p className="text-lg font-medium text-gray-600">No deals found</p>
            <p className="text-sm mt-1">
              {nearMeActive
                ? `No deals within ${nearMeRadius} km — try increasing the radius.`
                : 'Try a different category or search term.'}
            </p>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {deals.map((deal) => (
                <motion.div
                  key={deal.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
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
