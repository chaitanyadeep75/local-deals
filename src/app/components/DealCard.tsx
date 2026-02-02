'use client';

import { MapPinned, Eye, MousePointerClick } from 'lucide-react';

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

export default function DealCard({ deal }: { deal: Deal }) {
  const locationText =
    deal.area && deal.city
      ? `${deal.area}, ${deal.city}`
      : deal.city || 'Nearby';

  const openDirections = () => {
    if (!deal.latitude || !deal.longitude) return;

    const url = `https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition relative">
      {/* MAP ICON */}
      <button
        onClick={openDirections}
        className="absolute top-3 right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200"
        title="Get Directions"
      >
        <MapPinned size={18} />
      </button>

      <h3 className="font-semibold text-lg">{deal.title}</h3>
      <p className="text-gray-600 text-sm mt-1">{deal.description}</p>

      <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
        📍 {locationText}
      </p>

      <p className="text-xs text-gray-400 mt-1">
        Valid till {deal.valid_till_date ?? 'No expiry'}
      </p>

      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Eye size={14} /> {deal.views}
        </span>
        <span className="flex items-center gap-1">
          <MousePointerClick size={14} /> {deal.clicks}
        </span>
      </div>
    </div>
  );
}
