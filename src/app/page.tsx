'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import {
  Store,
  Eye,
  MousePointerClick,
  MapPin,
} from 'lucide-react';

type Deal = {
  id: number;
  title: string;
  description: string;
  valid_till_date: string | null;
  views: number;
  clicks: number;
  city: string | null;
};

export default function HomePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const [city, setCity] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(true);

  /* ---------- LOCATION DETECTION ---------- */
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;

          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();

          const detectedCity =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            null;

          setCity(detectedCity);
        } catch {
          setCity(null);
        } finally {
          setLocLoading(false);
        }
      },
      () => {
        setCity(null);
        setLocLoading(false);
      }
    );
  }, []);

  /* ---------- FETCH DEALS ---------- */
  const fetchDeals = async (selectedCity: string | null) => {
    let query = supabase
      .from('deals')
      .select(
        'id, title, description, valid_till_date, views, clicks, city'
      )
      .order('created_at', { ascending: false });

    if (selectedCity) {
      query = query.eq('city', selectedCity);
    }

    const { data, error } = await query;
    if (!error) setDeals(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDeals(city);
  }, [city]);

  /* ---------- INCREMENT VIEWS ---------- */
  useEffect(() => {
    if (deals.length === 0) return;

    supabase.rpc('increment_views', {
      deal_ids: deals.map((d) => d.id),
    });
  }, [deals]);

  /* ---------- CLICK ---------- */
  const handleClick = async (id: number) => {
    await supabase.rpc('increment_click', { deal_id: id });
  };

  return (
    <main className="min-h-screen bg-[var(--bg-main)]">
      {/* HERO / LOCATION */}
      <section className="max-w-7xl mx-auto px-4 pt-6">
        <div className="bg-black text-white rounded-3xl p-6 md:p-10 shadow-xl flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
          <div>
            <h1 className="font-extrabold text-3xl md:text-5xl leading-tight">
              Local Deals <br className="hidden md:block" />
              Near You
            </h1>

            <p className="text-gray-300 mt-2 max-w-md">
              Discover exclusive offers from nearby businesses in real time.
            </p>

            <div className="flex items-center gap-2 mt-4 text-sm text-gray-300">
              <MapPin size={16} />
              {locLoading && 'Detecting your location…'}
              {!locLoading && city && `Showing deals near ${city}`}
              {!locLoading && !city && 'Showing all deals'}
            </div>
          </div>

          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-white text-black px-6 py-4 rounded-2xl font-bold shadow hover:scale-[1.03] transition"
          >
            <Store size={20} />
            Business Signup
          </Link>
        </div>
      </section>

      {/* DEAL LIST */}
      <section className="max-w-7xl mx-auto px-4 pt-8 pb-14">
        {loading && (
          <p className="text-gray-500">Loading deals…</p>
        )}

        {!loading && deals.length === 0 && (
          <p className="text-gray-500">
            No deals found{city ? ` in ${city}` : ''}.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => (
            <div
              key={deal.id}
              onClick={() => handleClick(deal.id)}
              className="card cursor-pointer"
            >
              <h3 className="font-semibold text-lg text-gray-900">
                {deal.title}
              </h3>

              <p className="mt-1 text-gray-600">
                {deal.description}
              </p>

              <p className="mt-3 text-sm text-gray-500">
                {deal.city ?? 'Unknown city'} •{' '}
                {deal.valid_till_date
                  ? `Valid till ${deal.valid_till_date}`
                  : 'No expiry'}
              </p>

              <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Eye size={14} /> {deal.views}
                </span>
                <span className="flex items-center gap-1">
                  <MousePointerClick size={14} /> {deal.clicks}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
