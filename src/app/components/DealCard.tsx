'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { MapPinned, Eye, MousePointerClick } from 'lucide-react';
import { useState } from 'react';

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
  image?: string | null;
  rating?: number | null;
  rating_count?: number | null;
};

export default function DealCard({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const locationText =
    deal.area && deal.city
      ? `${deal.area}, ${deal.city}`
      : deal.city || 'Nearby';

  const openDeal = async () => {
    await supabase
      .from('deals')
      .update({ views: (deal.views || 0) + 1 })
      .eq('id', deal.id);

    router.push(`/deal/${deal.id}`);
  };

  const openDirections = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!deal.latitude || !deal.longitude) {
      alert('Location not available');
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`;
    window.open(url, '_blank');
  };

  const submitRating = async (
    e: React.MouseEvent,
    value: number
  ) => {
    e.stopPropagation();
    if (submitting) return;

    setSubmitting(true);

    const currentRating = deal.rating || 0;
    const currentCount = deal.rating_count || 0;

    const newTotal = currentRating * currentCount + value;
    const newCount = currentCount + 1;
    const newAverage = newTotal / newCount;

    await supabase
      .from('deals')
      .update({
        rating: newAverage,
        rating_count: newCount,
      })
      .eq('id', deal.id);

    window.location.reload();
  };

  return (
    <div
      onClick={openDeal}
      className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-2"
    >
      {/* IMAGE */}
      {deal.image ? (
        <img
          src={deal.image}
          alt={deal.title}
          className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110"
        />
      ) : (
        <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">
          No Image
        </div>
      )}

      <div className="p-4 relative">
        <button
          onClick={openDirections}
          className="absolute top-4 right-4 p-2 rounded-full bg-white shadow hover:bg-gray-100"
        >
          <MapPinned size={18} />
        </button>

        <h3 className="font-semibold text-lg">{deal.title}</h3>

        <p className="text-gray-600 text-sm mt-1">
          {deal.description}
        </p>

        <p className="text-sm text-gray-500 mt-2">
          📍 {locationText}
        </p>

        <p className="text-xs text-gray-400 mt-1">
          Valid till {deal.valid_till_date ?? 'No expiry'}
        </p>

        {/* RATING */}
        <div className="flex gap-1 mt-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={(e) => submitRating(e, star)}
              className="text-yellow-400 text-lg hover:scale-125 transition-transform duration-200"
            >
              ★
            </button>
          ))}

          <span className="text-xs text-gray-500 ml-2">
            {deal.rating ? deal.rating.toFixed(1) : '0.0'} (
            {deal.rating_count || 0})
          </span>
        </div>

        {/* STATS */}
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Eye size={14} /> {deal.views || 0}
          </span>
          <span className="flex items-center gap-1">
            <MousePointerClick size={14} />{' '}
            {deal.clicks || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
