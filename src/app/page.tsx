'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import DealCard from './components/DealCard';

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
};

export default function HomePage() {
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    const fetchDeals = async () => {
      const { data } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });

      setDeals(data || []);
    };

    fetchDeals();
  }, []);

  return (
    <main className="bg-gray-50 min-h-screen">
      {/* HERO */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <div className="bg-black text-white rounded-2xl p-10">
          <h1 className="text-4xl font-bold">Local Deals Near You</h1>
          <p className="text-gray-300 mt-2">
            Premium offers from nearby businesses, updated in real time.
          </p>
        </div>
      </section>

      {/* DEALS */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-semibold mb-6">Trending Deals</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </section>
    </main>
  );
}
