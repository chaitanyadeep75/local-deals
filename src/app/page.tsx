'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import {
  Store,
  Eye,
  MousePointerClick,
  MapPin,
  ArrowRight,
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

  useEffect(() => {
    supabase
      .from('deals')
      .select(
        'id, title, description, valid_till_date, views, clicks, city'
      )
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDeals(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <main className="space-y-14">

      {/* 🔥 HERO */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-gray-900 to-black text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,white,transparent_60%)]" />

        <div className="relative px-6 py-12 md:px-12 md:py-20 flex flex-col md:flex-row justify-between gap-10">
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
              Discover the best
              <br />
              local deals near you
            </h1>

            <p className="mt-4 text-gray-300 text-lg">
              Premium offers from nearby businesses, updated in real time.
            </p>

            <div className="flex items-center gap-2 mt-5 text-sm text-gray-300">
              <MapPin size={16} />
              {city ? `Showing deals near ${city}` : 'Location-based deals'}
            </div>

            <Link
              href="/signup"
              className="inline-flex items-center gap-3 mt-8 bg-white text-black px-7 py-4 rounded-2xl font-bold shadow-xl hover:scale-[1.04] transition"
            >
              <Store size={20} />
              List your business
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* 🧱 DEAL GRID */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold">
            Trending Deals
          </h2>
        </div>

        {loading && (
          <p className="text-gray-500">Loading deals…</p>
        )}

        {!loading && deals.length === 0 && (
          <p className="text-gray-500">No deals available.</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => (
            <div
              key={deal.id}
              className="group card cursor-pointer hover:shadow-2xl transition-all"
            >
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-black">
                {deal.title}
              </h3>

              <p className="mt-2 text-gray-600 line-clamp-3">
                {deal.description}
              </p>

              <div className="mt-4 text-sm text-gray-500">
                {deal.city ?? 'Local'} •{' '}
                {deal.valid_till_date
                  ? `Valid till ${deal.valid_till_date}`
                  : 'No expiry'}
              </div>

              <div className="flex items-center gap-5 mt-5 text-xs text-gray-400">
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
