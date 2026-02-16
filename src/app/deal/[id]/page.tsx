'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { MapPinned, Eye, MousePointerClick, ArrowLeft } from 'lucide-react';

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
  image: string | null; // ✅ using image
};

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);

  useEffect(() => {
    fetchDeal();
  }, []);

  const fetchDeal = async () => {
    const { data } = await supabase
      .from('deals')
      .select(
        'id, title, description, city, area, latitude, longitude, valid_till_date, views, clicks, image'
      ) // ✅ using image
      .eq('id', id)
      .single();

    if (data) setDeal(data);
  };

  const openDirections = () => {
    if (!deal?.latitude || !deal?.longitude) {
      alert('Location not available');
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`;
    window.open(url, '_blank');
  };

  if (!deal) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  const locationText =
    deal.area && deal.city
      ? `${deal.area}, ${deal.city}`
      : deal.city || 'Nearby';

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden transition hover:shadow-2xl">

        {/* IMAGE */}
        {deal.image ? (
          <img
            src={deal.image}
            alt={deal.title}
            className="w-full h-72 object-cover"
          />
        ) : (
          <div className="w-full h-72 bg-gray-200 flex items-center justify-center text-gray-500">
            No Image
          </div>
        )}

        <div className="p-6">

          {/* BACK */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-black"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <h1 className="text-2xl font-bold mb-2">
            {deal.title}
          </h1>

          <p className="text-gray-600 mb-4">
            {deal.description}
          </p>

          <p className="text-sm text-gray-500 mb-1">
            📍 {locationText}
          </p>

          <p className="text-xs text-gray-400 mb-4">
            Valid till {deal.valid_till_date ?? 'No expiry'}
          </p>

          <button
            onClick={openDirections}
            className="bg-black text-white px-5 py-3 rounded-xl hover:scale-105 transition"
          >
            <MapPinned size={16} className="inline mr-2" />
            Get Directions
          </button>

          <div className="flex gap-6 mt-6 text-gray-500 text-sm">
            <span className="flex items-center gap-1">
              <Eye size={16} /> {deal.views}
            </span>
            <span className="flex items-center gap-1">
              <MousePointerClick size={16} /> {deal.clicks}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
