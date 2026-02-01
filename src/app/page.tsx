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

  /* ---------- FETCH DEALS (CITY FILTER) ---------- */
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
    <main className="min-h-screen bg-gray-100">
      {/* HEADER */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">LocalDeals</h1>

          <div className="flex gap-3">
            <Link
              href="/signup"
              className="border px-4 py-2 rounded hover:bg-gray-100"
            >
              Business Signup
            </Link>
            <Link
              href="/login"
              className="bg-black text-white px-4 py-2 rounded"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-black text-white rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">
              Local Deals Near You
            </h2>
            <p className="text-gray-300">
              Discover the best offers from nearby businesses
            </p>

            <div className="flex items-center gap-2 mt-2 text-sm text-gray-300">
              <MapPin size={16} />
              {locLoading && 'Detecting your location…'}
              {!locLoading && city && `Showing deals near ${city}`}
              {!locLoading && !city && 'Showing all deals'}
            </div>
          </div>

          <Link
            href="/signup"
            className="flex items-center gap-2 bg-white text-black px-5 py-3 rounded font-semibold"
          >
            <Store size={20} />
            Business Signup
          </Link>
        </div>
      </section>

      {/* DEAL LIST */}
      <section className="max-w-6xl mx-auto px-4 pb-10">
        {loading && (
          <p className="text-gray-500">Loading deals…</p>
        )}

        {!loading && deals.length === 0 && (
          <p className="text-gray-500">
            No deals found{city ? ` in ${city}` : ''}.
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {deals.map((deal) => (
            <div
              key={deal.id}
              onClick={() => handleClick(deal.id)}
              className="bg-white p-5 rounded-lg shadow hover:shadow-lg transition cursor-pointer"
            >
              <h3 className="font-semibold text-lg">
                {deal.title}
              </h3>

              <p className="text-gray-700 mt-1">
                {deal.description}
              </p>

              <p className="text-sm text-gray-500 mt-2">
                {deal.city ?? 'Unknown city'} • Valid till{' '}
                {deal.valid_till_date ?? 'No expiry'}
              </p>

              <div className="flex gap-4 text-xs text-gray-400 mt-3">
                <span className="flex items-center gap-1">
                  <Eye size={14} /> {deal.views} views
                </span>
                <span className="flex items-center gap-1">
                  <MousePointerClick size={14} /> {deal.clicks} clicks
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
