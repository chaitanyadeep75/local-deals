'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { MapPinned, Eye, MousePointerClick } from 'lucide-react';

type Deal = {
  id: number;
  title: string;
  description: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  valid_till_date: string | null;
  views: number;
  clicks: number;
  image_url: string | null;
};

export default function DealDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);

  useEffect(() => {
    if (!params.id) return;

    fetchDeal();
  }, []);

  const fetchDeal = async () => {
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('id', params.id)
      .single();

    if (data) {
      setDeal(data);

      // 🔥 INCREASE VIEW COUNT
      await supabase
        .from('deals')
        .update({ views: data.views + 1 })
        .eq('id', data.id);
    }
  };

  const openDirections = async () => {
    if (!deal?.latitude || !deal?.longitude) {
      alert('Location not available');
      return;
    }

    // 🔥 INCREASE CLICK COUNT
    await supabase
      .from('deals')
      .update({ clicks: deal.clicks + 1 })
      .eq('id', deal.id);

    const url = `https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`;
    window.open(url, '_blank');
  };

  if (!deal) return <div className="p-10">Loading...</div>;

  return (
    <main className="bg-gray-50 min-h-screen py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-6">

        {deal.image_url && (
          <img
            src={deal.image_url}
            className="w-full h-72 object-cover rounded-xl mb-6"
          />
        )}

        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 mb-4"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold">{deal.title}</h1>
        <p className="text-gray-600 mt-2">{deal.description}</p>

        <p className="text-gray-500 mt-3">
          📍 {deal.city || 'Nearby'}
        </p>

        <p className="text-gray-400 mt-1">
          Valid till {deal.valid_till_date || 'No expiry'}
        </p>

        <button
          onClick={openDirections}
          className="mt-5 flex items-center gap-2 bg-black text-white px-5 py-2 rounded-lg"
        >
          <MapPinned size={18} />
          Get Directions
        </button>

        <div className="flex gap-6 mt-6 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Eye size={16} />
            {deal.views}
          </span>
          <span className="flex items-center gap-1">
            <MousePointerClick size={16} />
            {deal.clicks}
          </span>
        </div>
      </div>
    </main>
  );
}
