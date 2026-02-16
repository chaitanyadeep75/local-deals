'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import DealCard from '@/app/components/DealCard';
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
  image_url?: string | null;
  rating?: number | null;
  rating_count?: number | null;
  category?: string | null;
};

const categories = [
  'All',
  'Food',
  'Salon',
  'Spa',
  'Gym',
  'Pub',
  'Fashion',
  'Beauty',
  'Rental bikes and cars',
  'Shopping',
  'Services',
  'Auto',
  'Fitness',
];

export default function HomePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetchDeals = async () => {
    let query = supabase.from('deals').select('*');

    if (selectedCategory !== 'All') {
      query = query.eq('category', selectedCategory.toLowerCase());
    }

    const { data } = await query.order('created_at', {
      ascending: false,
    });

    setDeals(data || []);
  };

  useEffect(() => {
    fetchDeals();
  }, [selectedCategory]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* HERO */}
        <div className="relative rounded-3xl overflow-hidden mb-8 mt-6 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 opacity-95" />
          <div className="relative p-10 text-white">
            <h1 className="text-4xl font-extrabold tracking-tight">
              Discover Amazing Local Deals ✨
            </h1>
            <p className="mt-3 text-white/90 text-lg">
              Save more. Explore more. Experience more.
            </p>
          </div>
        </div>

        {/* CATEGORY PILLS */}
        <div className="flex gap-3 overflow-x-auto pb-4 mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-purple-100 hover:scale-105 shadow'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* DEAL GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </motion.div>
    </main>
  );
}
