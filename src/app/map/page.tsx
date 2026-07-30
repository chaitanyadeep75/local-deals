'use client';

import MapView, { Marker, Popup, type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeCheck, Compass, Crosshair, MapPinned, Search, SlidersHorizontal,
  Sparkles, Star, Timer, TrendingUp, ChevronDown, ChevronUp, X, Layers,
  Navigation, Flame, MapPin,
} from 'lucide-react';
import { getUrgencyLabel } from '@/app/lib/deal-utils';
import { trackEvent } from '@/app/lib/analytics';
import { CATEGORY_OPTIONS } from '@/app/lib/categories';

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
  image?: string | null;
  image_urls?: string[] | null;
  offer_price?: string | null;
  original_price?: string | null;
  discount_label?: string | null;
  is_boosted?: boolean | null;
};

type Bounds = { north: number; south: number; east: number; west: number };

type PinItem = {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  isCluster: boolean;
  hasVerified: boolean;
  isBoosted: boolean;
  deal?: Deal;
  deals?: Deal[];
};

const MAP_STYLE_KEY     = 'ld_map_style';
const VERIFIED_ONLY_KEY = 'ld_map_verified_only';

function StarRating({ rating, count }: { rating: number; count?: number | null }) {
  const stars = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <span key={s} style={{ color: s <= stars ? '#f59e0b' : '#d1d5db', fontSize: 11 }}>★</span>
      ))}
      <span className="ml-1 text-[11px] font-semibold text-amber-400">{rating.toFixed(1)}</span>
      {count != null && <span className="text-[10px] text-slate-500"> ({count})</span>}
    </span>
  );
}

function DiscountBadge({ offerPrice, originalPrice, discountLabel }: { offerPrice?: string | null; originalPrice?: string | null; discountLabel?: string | null }) {
  if (discountLabel) return <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{discountLabel}</span>;
  if (offerPrice && originalPrice) {
    const offer = parseFloat(offerPrice.replace(/[^\d.]/g, ''));
    const orig  = parseFloat(originalPrice.replace(/[^\d.]/g, ''));
    if (orig > offer && offer > 0) {
      const pct = Math.round(((orig - offer) / orig) * 100);
      return <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{pct}% OFF</span>;
    }
  }
  return null;
}

export default function MapPage() {
  const mapToken  = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapRef    = useRef<MapRef | null>(null);
  const [deals, setDeals]         = useState<Deal[]>([]);
  const [selected, setSelected]   = useState<Deal | null>(null);
  const [search, setSearch]       = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [mapStyle, setMapStyle]   = useState<'streets' | 'light' | 'satellite'>('streets');
  const [searchInArea, setSearchInArea] = useState(false);
  const [bounds, setBounds]       = useState<Bounds | null>(null);
  const [zoom, setZoom]           = useState(11);
  const [category, setCategory]   = useState('all');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [topPanelOpen, setTopPanelOpen]     = useState(true);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(MAP_STYLE_KEY);
    if (raw === 'streets' || raw === 'light' || raw === 'satellite') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapStyle(raw);
    }
    setVerifiedOnly(window.localStorage.getItem(VERIFIED_ONLY_KEY) === '1');
  }, []);

  useEffect(() => { window.localStorage.setItem(MAP_STYLE_KEY, mapStyle); }, [mapStyle]);
  useEffect(() => { window.localStorage.setItem(VERIFIED_ONLY_KEY, verifiedOnly ? '1' : '0'); }, [verifiedOnly]);

  useEffect(() => {
    const fetchDeals = async () => {
      // Fetch all deals that have coordinates — include null/active/paused status
      // to show as many pins as possible (paused deals still visible on map, just labeled)
      const { data, error } = await supabase
        .from('deals')
        .select('id, title, description, latitude, longitude, area, city, category, views, clicks, rating, rating_count, valid_till_date, status, is_verified, image, image_urls, offer_price, original_price, discount_label, is_boosted')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .neq('status', 'paused');   // only exclude paused

      if (!error && data) {
        setDeals(data as Deal[]);
        return;
      }

      // Fallback: older DB without some columns
      const fallback = await supabase
        .from('deals')
        .select('id, title, description, latitude, longitude, area, city, category, views, clicks, rating, rating_count, valid_till_date')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);
      setDeals((fallback.data || []) as Deal[]);
    };

    void fetchDeals();
  }, []);

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((deal) => {
      if (verifiedOnly && !deal.is_verified) return false;
      if (category !== 'all' && (deal.category || '').toLowerCase() !== category) return false;
      if (searchInArea && bounds) {
        if (!(deal.latitude <= bounds.north && deal.latitude >= bounds.south &&
              deal.longitude <= bounds.east  && deal.longitude >= bounds.west)) return false;
      }
      if (!q) return true;
      return (
        deal.title.toLowerCase().includes(q) ||
        deal.description.toLowerCase().includes(q) ||
        (deal.area  || '').toLowerCase().includes(q) ||
        (deal.city  || '').toLowerCase().includes(q) ||
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
        isBoosted: !!deal.is_boosted,
        deal,
      }));
    }

    const gridSize = zoom < 9 ? 0.08 : zoom < 11 ? 0.04 : 0.02;
    const grouped  = new Map<string, Deal[]>();
    for (const deal of filteredDeals) {
      const key = `${Math.round(deal.latitude / gridSize)}:${Math.round(deal.longitude / gridSize)}`;
      const existing = grouped.get(key);
      if (existing) existing.push(deal);
      else grouped.set(key, [deal]);
    }

    return Array.from(grouped.entries()).map(([key, group]) => {
      if (group.length === 1) {
        const deal = group[0];
        return { id: `single-${deal.id}`, latitude: deal.latitude, longitude: deal.longitude, count: 1, isCluster: false, hasVerified: !!deal.is_verified, isBoosted: !!deal.is_boosted, deal };
      }
      const latitude  = group.reduce((s, d) => s + d.latitude,  0) / group.length;
      const longitude = group.reduce((s, d) => s + d.longitude, 0) / group.length;
      return { id: `cluster-${key}`, latitude, longitude, count: group.length, isCluster: true, hasVerified: group.some((d) => d.is_verified), isBoosted: group.some((d) => d.is_boosted), deals: group };
    });
  }, [filteredDeals, zoom]);

  const topDeals = useMemo(
    () => [...filteredDeals]
      .sort((a, b) => {
        const aScore = (a.is_boosted ? 500 : 0) + (a.rating || 0) * 20 + (a.views || 0) * 0.1 + (a.clicks || 0) * 0.2;
        const bScore = (b.is_boosted ? 500 : 0) + (b.rating || 0) * 20 + (b.views || 0) * 0.1 + (b.clicks || 0) * 0.2;
        return bScore - aScore;
      })
      .slice(0, 6),
    [filteredDeals]
  );

  const mapStyleUrl = useMemo(() => {
    if (mapStyle === 'light')     return 'mapbox://styles/mapbox/light-v11';
    if (mapStyle === 'satellite') return 'mapbox://styles/mapbox/satellite-streets-v12';
    return 'mapbox://styles/mapbox/streets-v11';
  }, [mapStyle]);

  const updateBoundsFromMap = () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    setBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
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
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setUserLocation({ lat, lng });
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 13.5, duration: 1200 });
        setLoadingLocation(false);
        void trackEvent('map_use_my_location', { success: true });
      },
      () => { setLoadingLocation(false); void trackEvent('map_use_my_location', { success: false }); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const coverImage = (deal: Deal) => deal.image_urls?.[0] || deal.image || null;

  return (
    <main className="relative h-[calc(100vh-64px)]">
      {mapToken ? (
        <MapView
          ref={mapRef}
          mapboxAccessToken={mapToken}
          initialViewState={{ latitude: 12.9716, longitude: 77.5946, zoom: 11 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle={mapStyleUrl}
          onLoad={updateBoundsFromMap}
          onMoveEnd={updateBoundsFromMap}
          onClick={() => setSelected(null)}
        >
          {/* ── Deal Pins ── */}
          {pinItems.map((item) => (
            <Marker
              key={item.id}
              latitude={item.latitude}
              longitude={item.longitude}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                if (item.isCluster) {
                  mapRef.current?.flyTo({ center: [item.longitude, item.latitude], zoom: Math.min(15, zoom + 2), duration: 700 });
                  return;
                }
                if (!item.deal) return;
                setSelected(item.deal);
                void trackEvent('map_marker_click', { deal_id: item.deal.id });
              }}
            >
              {item.isCluster ? (
                <button type="button"
                  aria-label={`${item.count} deals in this area`}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-extrabold shadow-lg transition-all duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
                    ${item.hasVerified
                      ? 'border-emerald-300 bg-emerald-500 text-white'
                      : 'border-indigo-300 bg-indigo-600 text-white'}`}
                >
                  {item.count}
                </button>
              ) : (
                <button type="button"
                  aria-label={`Open ${item.deal?.title || 'deal'}`}
                  className={`group relative flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-lg transition-all duration-150 hover:scale-125 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
                    ${activeSelected?.id === item.deal?.id
                      ? 'border-amber-300 bg-amber-400 text-amber-900 scale-125'
                      : item.isBoosted
                        ? 'border-fuchsia-300 bg-fuchsia-500 text-white'
                        : item.hasVerified
                          ? 'border-emerald-200 bg-emerald-500 text-white'
                          : 'border-rose-200 bg-rose-500 text-white'}`}
                >
                  <MapPinned className="h-3.5 w-3.5" />
                  {/* Drop shadow dot */}
                  <span className="absolute -bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-black/20 blur-[2px]" />
                </button>
              )}
            </Marker>
          ))}

          {/* ── User Location Dot ── */}
          {userLocation && (
            <Marker latitude={userLocation.lat} longitude={userLocation.lng}>
              <span className="block h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow-lg ring-4 ring-sky-300/40" />
            </Marker>
          )}

          {/* ── Deal Popup ── */}
          {activeSelected && (
            <Popup
              latitude={activeSelected.latitude}
              longitude={activeSelected.longitude}
              onClose={() => setSelected(null)}
              closeOnClick={false}
              maxWidth="280px"
              offset={16}
            >
              <div className="overflow-hidden rounded-2xl bg-slate-900 text-sm">
                {/* Image */}
                {coverImage(activeSelected) && (
                  <div className="relative -mx-3 -mt-3 mb-2 h-32 w-[calc(100%+24px)]">
                    <Image
                      src={coverImage(activeSelected)!}
                      alt={activeSelected.title}
                      fill
                      className="object-cover"
                      sizes="280px"
                    />
                    {/* Discount overlay */}
                    <div className="absolute left-2 top-2">
                      <DiscountBadge offerPrice={activeSelected.offer_price} originalPrice={activeSelected.original_price} discountLabel={activeSelected.discount_label} />
                    </div>
                    {activeSelected.is_boosted && (
                      <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        <Flame size={9} /> Boosted
                      </span>
                    )}
                  </div>
                )}

                <div className="px-3 pb-3">
                  {/* Title & badges */}
                  <h3 className="font-bold text-slate-100 leading-snug">{activeSelected.title}</h3>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {activeSelected.is_verified && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                        <BadgeCheck size={10} /> Verified
                      </span>
                    )}
                    {getUrgencyLabel(activeSelected.valid_till_date || null) && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
                        <Timer size={10} /> {getUrgencyLabel(activeSelected.valid_till_date || null)}
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{activeSelected.description}</p>

                  {/* Location */}
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
                    <Navigation size={10} className="shrink-0" />
                    {[activeSelected.area, activeSelected.city].filter(Boolean).join(', ') || 'Location'}
                  </p>

                  {/* Rating + views */}
                  <div className="mt-1.5 flex items-center gap-2">
                    {(activeSelected.rating || 0) > 0 && (
                      <StarRating rating={activeSelected.rating || 0} count={activeSelected.rating_count} />
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                      <TrendingUp size={10} /> {activeSelected.views || 0} views
                    </span>
                  </div>

                  {/* CTA buttons */}
                  <div className="mt-3 flex items-center gap-1.5">
                    <button
                      onClick={() => openDirections(activeSelected.latitude, activeSelected.longitude, activeSelected.id)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-2.5 py-2 text-xs font-semibold text-white shadow-neon-violet transition-transform duration-150 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    >
                      <Compass size={11} /> Directions
                    </button>
                    <Link
                      href={`/deal/${activeSelected.id}`}
                      onClick={() => { void trackEvent('map_view_deal_click', { deal_id: activeSelected.id }); }}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/10 bg-slate-800/80 px-2.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    >
                      <Sparkles size={11} /> View deal
                    </Link>
                  </div>
                </div>
              </div>
            </Popup>
          )}
        </MapView>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-950 px-4 text-center">
          <div className="max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-card backdrop-blur-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
              <MapPin size={22} className="text-amber-400" />
            </div>
            <p className="mt-4 text-base font-extrabold tracking-tight text-slate-100">Map not configured</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Add <code className="rounded bg-slate-800/80 px-1.5 py-0.5 text-amber-300">NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment and redeploy.
            </p>
          </div>
        </div>
      )}

      {/* ── TOP FILTER PANEL ── */}
      <section className="pointer-events-none absolute left-3 top-3 z-20 w-[calc(100%-24px)] max-w-sm rounded-3xl border border-white/10 bg-slate-900/90 shadow-card backdrop-blur-xl md:left-4 md:top-4 md:max-w-md">
        <div className="pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-violet-400" />
              <span className="text-sm font-bold tracking-tight text-slate-100">Map Explore</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                {filteredDeals.length} pins
              </span>
              <button type="button" onClick={() => setTopPanelOpen((p) => !p)}
                aria-label={topPanelOpen ? 'Collapse filters' : 'Expand filters'}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-slate-800/80 text-slate-300 transition hover:bg-slate-700/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 md:hidden">
                {topPanelOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className={`${topPanelOpen ? 'block' : 'hidden'} max-h-[45vh] overflow-y-auto px-4 pb-4 md:block md:max-h-none`}>
            {/* Search */}
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, area, city..."
                className="w-full rounded-2xl border border-white/10 bg-slate-800/80 py-2.5 pl-9 pr-8 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus-visible:ring-2 focus-visible:ring-violet-500/40"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 rounded-full">
                  <X size={14} />
                </button>
              )}
            </label>

            {/* Quick filter buttons */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => { setVerifiedOnly((v) => !v); void trackEvent('map_verified_only_toggle', { active: !verifiedOnly }); }}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
                  ${verifiedOnly ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-slate-800/80 text-slate-300 hover:bg-slate-800'}`}>
                <BadgeCheck size={11} /> Verified
              </button>
              <button type="button" onClick={handleUseMyLocation}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-sky-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
                <Crosshair size={11} /> {loadingLocation ? 'Locating…' : 'Near me'}
              </button>
              <button type="button" onClick={() => { const n = !searchInArea; setSearchInArea(n); void trackEvent('map_search_area_toggle', { active: n }); }}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
                  ${searchInArea ? 'border-violet-400/40 bg-violet-500/15 text-violet-300' : 'border-white/10 bg-slate-800/80 text-slate-300 hover:bg-slate-800'}`}>
                Search this area
              </button>
            </div>

            {/* Category chips */}
            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button key="all" type="button" onClick={() => setCategory('all')}
                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
                  ${category === 'all' ? 'border-violet-400/40 bg-violet-500/15 text-violet-300' : 'border-white/10 bg-slate-800/80 text-slate-400 hover:bg-slate-800'}`}>
                All
              </button>
              {CATEGORY_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setCategory(opt.value)}
                  className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
                    ${category === opt.value ? 'border-violet-400/40 bg-violet-500/15 text-violet-300' : 'border-white/10 bg-slate-800/80 text-slate-400 hover:bg-slate-800'}`}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Map style */}
            <div className="mt-3 flex items-center gap-1.5">
              <Layers size={11} className="shrink-0 text-slate-500" />
              {(['streets', 'light', 'satellite'] as const).map((style) => (
                <button key={style} type="button" onClick={() => setMapStyle(style)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
                    ${mapStyle === style ? 'border-violet-400/40 bg-violet-500/15 text-violet-300' : 'border-white/10 bg-slate-800/80 text-slate-400 hover:bg-slate-800'}`}>
                  {style}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── BOTTOM DEALS PANEL ── */}
      <section className="pointer-events-none absolute bottom-[74px] left-3 z-20 w-[calc(100%-24px)] max-w-sm rounded-3xl border border-white/10 bg-slate-900/90 shadow-card backdrop-blur-xl md:bottom-4 md:left-4 md:max-w-md">
        <div className="pointer-events-auto">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Star size={13} className="text-amber-400" fill="currentColor" />
              <span className="text-sm font-bold tracking-tight text-slate-100">Top nearby</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/" className="text-[11px] font-medium text-slate-400 transition hover:text-slate-200">Open feed →</Link>
              <button type="button" onClick={() => setBottomPanelOpen((p) => !p)}
                aria-label={bottomPanelOpen ? 'Collapse top deals' : 'Expand top deals'}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-slate-800/80 text-slate-300 transition hover:bg-slate-700/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 md:hidden">
                {bottomPanelOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              </button>
            </div>
          </div>

          <div className={`${bottomPanelOpen ? 'block' : 'hidden'} md:block`}>
            <div className="max-h-40 space-y-1.5 overflow-auto px-3 pb-3 md:max-h-48">
              {topDeals.length ? (
                <AnimatePresence initial={false}>
                  {topDeals.map((deal, i) => (
                    <motion.button
                      key={`top-${deal.id}`}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.05 }}
                      onClick={() => {
                        setSelected(deal);
                        mapRef.current?.flyTo({ center: [deal.longitude, deal.latitude], zoom: Math.max(13, zoom), duration: 700 });
                        void trackEvent('map_top_deal_click', { deal_id: deal.id });
                      }}
                      className="card-press flex w-full items-center gap-2.5 rounded-2xl border border-white/5 bg-slate-800/60 px-2.5 py-2 text-left transition hover:border-violet-400/30 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    >
                      {coverImage(deal) && (
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                          <Image src={coverImage(deal)!} alt={deal.title} fill className="object-cover" sizes="36px" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="truncate text-xs font-semibold text-slate-100">{deal.title}</p>
                          {deal.is_boosted && <Flame size={10} className="shrink-0 text-fuchsia-400" />}
                        </div>
                        <p className="truncate text-[10px] text-slate-500">{deal.area || deal.city || 'Unknown area'}</p>
                      </div>
                      {(deal.rating || 0) > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/20 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                          <Star size={9} fill="currentColor" /> {(deal.rating || 0).toFixed(1)}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/5 bg-slate-800/40 px-4 py-6 text-center">
                  <MapPin size={20} className="text-slate-600" />
                  <p className="text-xs leading-relaxed text-slate-500">No deals match the current filters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
