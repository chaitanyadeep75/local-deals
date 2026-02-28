'use client';

import MapView, { Marker, Popup, type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import {
  BadgeCheck,
  Compass,
  Crosshair,
  ListFilter,
  MapPinned,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getUrgencyLabel } from '@/app/lib/deal-utils';
import { trackEvent } from '@/app/lib/analytics';

type Deal = {
  id: number;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  area: string | null;
  city: string | null;
  category?: string | null;
  views?: number | null;
  clicks?: number | null;
  rating?: number | null;
  rating_count?: number | null;
  valid_till_date?: string | null;
  status?: string | null;
  is_verified?: boolean | null;
};

type Bounds = { north: number; south: number; east: number; west: number };

type PinItem = {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  isCluster: boolean;
  hasVerified: boolean;
  deal?: Deal;
  deals?: Deal[];
};

const MAP_STYLE_KEY = 'ld_map_style';
const VERIFIED_ONLY_KEY = 'ld_map_verified_only';

export default function MapPage() {
  const mapRef = useRef<MapRef | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selected, setSelected] = useState<Deal | null>(null);
  const [search, setSearch] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [mapStyle, setMapStyle] = useState<'streets' | 'light' | 'satellite'>('streets');
  const [searchInArea, setSearchInArea] = useState(false);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [zoom, setZoom] = useState(11);
  const [category, setCategory] = useState('all');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [topPanelOpen, setTopPanelOpen] = useState(true);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(MAP_STYLE_KEY);
    if (raw === 'streets' || raw === 'light' || raw === 'satellite') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapStyle(raw);
    }
    setVerifiedOnly(window.localStorage.getItem(VERIFIED_ONLY_KEY) === '1');
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MAP_STYLE_KEY, mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    window.localStorage.setItem(VERIFIED_ONLY_KEY, verifiedOnly ? '1' : '0');
  }, [verifiedOnly]);

  useEffect(() => {
    const fetchDeals = async () => {
      const primary = await supabase
        .from('deals')
        .select('id, title, description, latitude, longitude, area, city, category, views, clicks, rating, rating_count, valid_till_date, status, is_verified')
        .eq('status', 'active')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      let data = (primary.data || null) as Deal[] | null;
      const error = primary.error;

      if (error && (error.code === '42703' || String(error.message || '').toLowerCase().includes('status'))) {
        const fallback = await supabase
          .from('deals')
          .select('id, title, description, latitude, longitude, area, city, category, views, clicks, rating, rating_count, valid_till_date')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);
        data = (fallback.data || null) as Deal[] | null;
      }

      setDeals(data || []);
    };

    void fetchDeals();
  }, []);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const deal of deals) {
      const cat = (deal.category || '').trim();
      if (cat) unique.add(cat.toLowerCase());
    }
    return ['all', ...Array.from(unique).slice(0, 6)];
  }, [deals]);

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((deal) => {
      if (verifiedOnly && !deal.is_verified) return false;
      if (category !== 'all' && (deal.category || '').toLowerCase() !== category) return false;
      if (searchInArea && bounds) {
        const inLat = deal.latitude <= bounds.north && deal.latitude >= bounds.south;
        const inLng = deal.longitude <= bounds.east && deal.longitude >= bounds.west;
        if (!(inLat && inLng)) return false;
      }
      if (!q) return true;
      return (
        deal.title.toLowerCase().includes(q) ||
        deal.description.toLowerCase().includes(q) ||
        (deal.area || '').toLowerCase().includes(q) ||
        (deal.city || '').toLowerCase().includes(q) ||
        (deal.category || '').toLowerCase().includes(q)
      );
    });
  }, [deals, search, verifiedOnly, searchInArea, bounds, category]);

  const activeSelected = useMemo(() => {
    if (!selected) return null;
    return filteredDeals.some((d) => d.id === selected.id) ? selected : null;
  }, [filteredDeals, selected]);

  const pinItems = useMemo<PinItem[]>(() => {
    if (zoom >= 12.5) {
      return filteredDeals.map((deal) => ({
        id: `deal-${deal.id}`,
        latitude: deal.latitude,
        longitude: deal.longitude,
        count: 1,
        isCluster: false,
        hasVerified: !!deal.is_verified,
        deal,
      }));
    }

    const gridSize = zoom < 9 ? 0.08 : zoom < 11 ? 0.04 : 0.02;
    const grouped = new Map<string, Deal[]>();
    for (const deal of filteredDeals) {
      const key = `${Math.round(deal.latitude / gridSize)}:${Math.round(deal.longitude / gridSize)}`;
      const existing = grouped.get(key);
      if (existing) existing.push(deal);
      else grouped.set(key, [deal]);
    }

    return Array.from(grouped.entries()).map(([key, group]) => {
      if (group.length === 1) {
        const deal = group[0];
        return {
          id: `single-${deal.id}`,
          latitude: deal.latitude,
          longitude: deal.longitude,
          count: 1,
          isCluster: false,
          hasVerified: !!deal.is_verified,
          deal,
        };
      }
      const latitude = group.reduce((sum, d) => sum + d.latitude, 0) / group.length;
      const longitude = group.reduce((sum, d) => sum + d.longitude, 0) / group.length;
      return {
        id: `cluster-${key}`,
        latitude,
        longitude,
        count: group.length,
        isCluster: true,
        hasVerified: group.some((d) => d.is_verified),
        deals: group,
      };
    });
  }, [filteredDeals, zoom]);

  const topDeals = useMemo(
    () =>
      [...filteredDeals]
        .sort((a, b) => {
          const aScore = (a.rating || 0) * 20 + (a.views || 0) * 0.1 + (a.clicks || 0) * 0.2;
          const bScore = (b.rating || 0) * 20 + (b.views || 0) * 0.1 + (b.clicks || 0) * 0.2;
          return bScore - aScore;
        })
        .slice(0, 4),
    [filteredDeals]
  );

  const mapStyleUrl = useMemo(() => {
    if (mapStyle === 'light') return 'mapbox://styles/mapbox/light-v11';
    if (mapStyle === 'satellite') return 'mapbox://styles/mapbox/satellite-streets-v12';
    return 'mapbox://styles/mapbox/streets-v11';
  }, [mapStyle]);

  const updateBoundsFromMap = () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    setBounds({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });
    setZoom(map.getZoom());
  };

  const openDirections = (lat: number, lng: number, dealId?: number) => {
    void trackEvent('directions_clicked', { deal_id: dealId ?? null, surface: 'map_popup' });
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng });
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 13.5, duration: 1200 });
        setLoadingLocation(false);
        void trackEvent('map_use_my_location', { success: true });
      },
      () => {
        setLoadingLocation(false);
        void trackEvent('map_use_my_location', { success: false });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleSearchInArea = () => {
    const next = !searchInArea;
    setSearchInArea(next);
    void trackEvent('map_search_area_toggle', { active: next });
  };

  return (
    <main className="relative h-[calc(100vh-64px)]">
      <MapView
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          latitude: 12.9716,
          longitude: 77.5946,
          zoom: 11,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyleUrl}
        onLoad={updateBoundsFromMap}
        onMoveEnd={updateBoundsFromMap}
      >
        {pinItems.map((item) => (
          <Marker
            key={item.id}
            latitude={item.latitude}
            longitude={item.longitude}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              if (item.isCluster) {
                mapRef.current?.flyTo({
                  center: [item.longitude, item.latitude],
                  zoom: Math.min(15, zoom + 2),
                  duration: 700,
                });
                return;
              }
              if (!item.deal) return;
              setSelected(item.deal);
              void trackEvent('map_marker_click', { deal_id: item.deal.id });
            }}
          >
            {item.isCluster ? (
              <button
                type="button"
                className={`rounded-full border px-2 py-1 text-[11px] font-bold shadow-lg ${
                  item.hasVerified
                    ? 'border-indigo-300 bg-indigo-500 text-white'
                    : 'border-slate-300 bg-slate-800 text-white'
                }`}
              >
                {item.count}
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Open ${item.deal?.title || 'deal'}`}
                className={`group relative rounded-full border px-1.5 py-1 shadow-lg transition hover:scale-105 ${
                  activeSelected?.id === item.deal?.id
                    ? 'border-amber-300 bg-amber-400 text-amber-900'
                    : item.deal?.is_verified
                      ? 'border-emerald-300 bg-emerald-400 text-emerald-900'
                      : 'border-rose-300 bg-rose-400 text-rose-900'
                }`}
              >
                <MapPinned className="h-4 w-4" />
                <span className="absolute -bottom-4 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-slate-900/30 blur-[1px]" />
              </button>
            )}
          </Marker>
        ))}

        {userLocation && (
          <Marker latitude={userLocation.lat} longitude={userLocation.lng}>
            <span className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500 shadow-md" />
          </Marker>
        )}

        {activeSelected && (
          <Popup
            latitude={activeSelected.latitude}
            longitude={activeSelected.longitude}
            onClose={() => setSelected(null)}
            closeOnClick={false}
          >
            <div className="min-w-56 text-sm">
              <h3 className="font-semibold text-slate-900">{activeSelected.title}</h3>
              {activeSelected.is_verified && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <BadgeCheck size={12} />
                  Verified business
                </p>
              )}
              <p className="mt-2 line-clamp-3 text-xs text-slate-600">{activeSelected.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                {activeSelected.area || 'Area'}, {activeSelected.city || 'City'}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                  <Star size={11} />
                  {(activeSelected.rating || 0).toFixed(1)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                  <TrendingUp size={11} />
                  {activeSelected.views || 0} views
                </span>
                {getUrgencyLabel(activeSelected.valid_till_date || null) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                    <Timer size={11} />
                    {getUrgencyLabel(activeSelected.valid_till_date || null)}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => openDirections(activeSelected.latitude, activeSelected.longitude, activeSelected.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Compass size={12} />
                  Directions
                </button>
                <Link
                  href={`/deal/${activeSelected.id}`}
                  onClick={() => { void trackEvent('map_view_deal_click', { deal_id: activeSelected.id }); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Sparkles size={12} />
                  View deal
                </Link>
              </div>
            </div>
          </Popup>
        )}
      </MapView>

      <section className="pointer-events-none absolute left-3 top-3 z-20 w-[calc(100%-24px)] max-w-md rounded-2xl border border-white/50 bg-white/90 p-3 shadow-xl backdrop-blur md:left-4 md:top-4 md:p-4">
        <div className="pointer-events-auto">
          <div className="mb-2 flex items-center justify-between md:mb-3">
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
              <SlidersHorizontal size={14} />
              Map discover
            </p>
            <div className="flex items-center gap-1.5">
              <p className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                {filteredDeals.length} live pins
              </p>
              <button
                type="button"
                onClick={() => setTopPanelOpen((prev) => !prev)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 md:hidden"
                aria-label="Toggle map filters"
              >
                {topPanelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          <div className={`${topPanelOpen ? 'block' : 'hidden'} max-h-[42vh] overflow-y-auto pr-1 md:block md:max-h-none md:overflow-visible md:pr-0`}>
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, area, city..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none ring-0 focus:border-indigo-300"
              />
            </label>

            <div className="mt-2.5 flex flex-wrap items-center gap-2 md:mt-3">
              <button
                type="button"
                onClick={() => {
                  const next = !verifiedOnly;
                  setVerifiedOnly(next);
                  void trackEvent('map_verified_only_toggle', { active: next });
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  verifiedOnly
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck size={12} />
                  Verified only
                </span>
              </button>
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-200"
              >
                <span className="inline-flex items-center gap-1">
                  <Crosshair size={12} />
                  {loadingLocation ? 'Locating...' : 'Use my location'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleSearchInArea}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  searchInArea ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Search this area
              </button>
            </div>

            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    category === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'all' ? 'All categories' : cat}
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setMapStyle('streets')}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  mapStyle === 'streets' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Streets
              </button>
              <button
                type="button"
                onClick={() => setMapStyle('light')}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  mapStyle === 'light' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setMapStyle('satellite')}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  mapStyle === 'satellite' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Satellite
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="pointer-events-none absolute bottom-[74px] left-3 z-20 w-[calc(100%-24px)] max-w-md rounded-2xl border border-white/50 bg-white/90 p-3 shadow-xl backdrop-blur md:bottom-4 md:left-4 md:p-4">
        <div className="pointer-events-auto">
          <div className="mb-2 flex items-center justify-between">
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800">
              <ListFilter size={14} />
              Popular near this area
            </p>
            <div className="flex items-center gap-1.5">
              <Link href="/" className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700">
                Open feed
              </Link>
              <button
                type="button"
                onClick={() => setBottomPanelOpen((prev) => !prev)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 md:hidden"
                aria-label="Toggle popular deals panel"
              >
                {bottomPanelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
          </div>

          <div className={`${bottomPanelOpen ? 'block' : 'hidden'} md:block`}>
            <div className="max-h-32 space-y-1.5 overflow-auto pr-1 md:max-h-40">
            {topDeals.length ? (
              topDeals.map((deal) => (
                <button
                  key={`top-${deal.id}`}
                  type="button"
                  onClick={() => {
                    setSelected(deal);
                    mapRef.current?.flyTo({ center: [deal.longitude, deal.latitude], zoom: Math.max(13, zoom), duration: 700 });
                    void trackEvent('map_top_deal_click', { deal_id: deal.id });
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{deal.title}</p>
                    <p className="truncate text-[11px] text-slate-500">{deal.area || 'Unknown area'}</p>
                  </div>
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    <Star size={10} />
                    {(deal.rating || 0).toFixed(1)}
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                No matching pins found. Try clearing filters.
              </div>
            )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
