'use client';

export const dynamic = 'force-dynamic';


import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import Link from 'next/link';
import { Store, Eye, MousePointerClick } from 'lucide-react';

type Deal = {
  id: number;
  title: string;
  description: string;
  valid_till_date: string | null;
  views: number;
  clicks: number;
};

export default function HomePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------- FETCH ACTIVE DEALS ---------- */
  const fetchDeals = async () => {
    const { data, error } = await supabase
      .from('deals')
      .select(
        'id, title, description, valid_till_date, views, clicks'
      )
      .order('created_at', { ascending: false });

    if (!error) setDeals(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  /* ---------- INCREMENT VIEWS ---------- */
  useEffect(() => {
    if (deals.length === 0) return;

    supabase.rpc('increment_views', {
      deal_ids: deals.map(d => d.id),
    });
  }, [deals]);

  /* ---------- CLICK ---------- */
  const handleClick = async (id: number) => {
    await supabase.rpc('increment_click', { deal_id: id });
  };

  return (
    <div className="p-4 md:p-6">
      {/* HERO / CTA */}
      <div className="bg-black text-white rounded-lg p-6 mb-8 flex flex-col md:flex-row justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">
            Local Deals Near You
          </h1>
          <p className="text-gray-300">
            Discover the best offers from nearby businesses.
          </p>
        </div>

        <Link
          href="/signup"
          className="mt-4 md:mt-0 flex items-center gap-2 bg-white text-black px-5 py-3 rounded font-semibold"
        >
          <Store size={20} />
          Business Signup
        </Link>
      </div>

      {/* DEAL LIST */}
      {loading && <p>Loading deals...</p>}

      {!loading && deals.length === 0 && (
        <p className="text-gray-500">No active deals available.</p>
      )}

      <div className="space-y-4">
        {deals.map((deal) => (
          <div
            key={deal.id}
            onClick={() => handleClick(deal.id)}
            className="bg-white p-5 rounded shadow hover:shadow-md transition cursor-pointer"
          >
            <h2 className="font-semibold text-lg">
              {deal.title}
            </h2>

            <p className="text-gray-700 mt-1">
              {deal.description}
            </p>

            <p className="text-sm text-gray-500 mt-2">
              Valid till:{' '}
              {deal.valid_till_date ?? 'No expiry'}
            </p>

            {/* ANALYTICS */}
            <div className="flex gap-4 text-xs text-gray-400 mt-2">
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
    </div>
  );
}
