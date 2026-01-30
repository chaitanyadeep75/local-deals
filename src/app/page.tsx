'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';

type Deal = {
  id: number;
  title: string;
  description: string;
  valid_till: string | null;
};

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // FETCH DEALS
  useEffect(() => {
    const fetchDeals = async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch error:', error);
      } else {
        setDeals(data || []);
      }

      setLoading(false);
    };

    fetchDeals();
  }, []);

  // DELETE DEAL
  const handleDelete = async (id: number) => {
    const confirmDelete = confirm('Are you sure you want to delete this deal?');
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Failed to delete deal');
      console.error(error);
    } else {
      setDeals((prev) => prev.filter((deal) => deal.id !== id));
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-2">Local Deals Near You</h1>
      <p className="text-gray-600 mb-6">
        Find today’s best offers from nearby shops.
      </p>

      {loading && <p>Loading...</p>}

      <div className="space-y-4">
        {deals.map((deal) => (
          <div key={deal.id} className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold">{deal.title}</h2>
            <p>{deal.description}</p>

            {deal.valid_till && (
              <p className="text-sm text-gray-500">
                Valid till {deal.valid_till}
              </p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
