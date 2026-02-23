'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { MapPin, Eye, MousePointerClick, ArrowLeft, Navigation, AlertCircle, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

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
  image: string | null;
  category: string | null;
  rating: number | null;
  rating_count: number | null;
};

function locationLabel(deal: Deal): string {
  const parts = [deal.area, deal.city].filter(Boolean);
  if (parts.length) return parts.join(', ');
  if (deal.latitude && deal.longitude)
    return `${deal.latitude.toFixed(4)}, ${deal.longitude.toFixed(4)}`;
  return null as any;
}

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [dirError, setDirError] = useState(false);

  useEffect(() => {
    fetchDeal();
  }, []);

  const fetchDeal = async () => {
    const { data } = await supabase
      .from('deals')
      .select('id, title, description, city, area, latitude, longitude, valid_till_date, views, clicks, image, category, rating, rating_count')
      .eq('id', id)
      .single();
    if (data) setDeal(data);
  };

  const openDirections = () => {
    if (!deal?.latitude || !deal?.longitude) {
      setDirError(true);
      return;
    }
    setDirError(false);
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`,
      '_blank'
    );
  };

  const openMapsSearch = () => {
    // Fallback: search by business name if no coords
    const query = encodeURIComponent(`${deal?.title} ${deal?.city || ''}`);
    window.open(`https://www.google.com/maps/search/${query}`, '_blank');
  };

  if (!deal) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-3 text-gray-400">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading deal…</p>
      </div>
    );
  }

  const label = locationLabel(deal);
  const canNavigate = !!(deal.latitude && deal.longitude);
  const formattedDate = deal.valid_till_date
    ? new Date(deal.valid_till_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        {/* IMAGE */}
        {deal.image ? (
          <img src={deal.image} alt={deal.title} className="w-full h-72 object-cover" />
        ) : (
          <div className="w-full h-72 bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}

        <div className="p-6">
          {/* BACK */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-500 mb-5 hover:text-black transition"
          >
            <ArrowLeft size={16} /> Back
          </button>

          {/* CATEGORY badge */}
          {deal.category && (
            <span className="inline-block text-xs font-medium bg-purple-100 text-purple-700 px-3 py-1 rounded-full mb-3 capitalize">
              {deal.category}
            </span>
          )}

          <h1 className="text-2xl font-bold mb-2">{deal.title}</h1>
          <p className="text-gray-600 mb-5">{deal.description}</p>

          {/* LOCATION */}
          <div className="flex items-start gap-2 mb-2">
            <MapPin size={16} className={`mt-0.5 shrink-0 ${canNavigate ? 'text-purple-500' : 'text-gray-300'}`} />
            <div>
              {label ? (
                <p className="text-sm text-gray-700">{label}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Location not saved for this deal</p>
              )}
            </div>
          </div>

          {/* EXPIRY */}
          {formattedDate && (
            <p className="text-xs text-gray-400 mb-5 ml-6">Valid till {formattedDate}</p>
          )}

          {/* RATING */}
          {(deal.rating_count || 0) > 0 && (
            <div className="flex items-center gap-1 mb-5 ml-0">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={`text-xl ${star <= Math.round(deal.rating || 0) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
              ))}
              <span className="text-sm text-gray-500 ml-2">
                {deal.rating?.toFixed(1)} ({deal.rating_count} reviews)
              </span>
            </div>
          )}

          {/* DIRECTIONS */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={openDirections}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all
                ${canNavigate
                  ? 'bg-black text-white hover:scale-105 hover:bg-gray-800'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
            >
              <Navigation size={16} />
              Get Directions
            </button>

            {/* If no coords, offer a Google Maps name search instead */}
            {!canNavigate && (
              <button
                onClick={openMapsSearch}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
              >
                <ExternalLink size={15} />
                Search on Maps
              </button>
            )}
          </div>

          {/* Inline error — no alert() */}
          {dirError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">No GPS coordinates saved</p>
                <p className="text-xs mt-0.5">
                  This deal was created before location was added.
                  Use "Search on Maps" above, or ask the business to re-add their deal with a location.
                </p>
              </div>
            </motion.div>
          )}

          {/* STATS */}
          <div className="flex gap-6 mt-6 text-gray-400 text-sm">
            <span className="flex items-center gap-1.5">
              <Eye size={15} /> {deal.views} views
            </span>
            <span className="flex items-center gap-1.5">
              <MousePointerClick size={15} /> {deal.clicks} clicks
            </span>
          </div>
        </div>
      </motion.div>
    </main>
  );
}