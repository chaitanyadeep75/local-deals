'use client';

import Link from 'next/link';
import { getCategoryMeta } from '@/app/lib/categories';
import { getDiscountPct, haversineKm, formatDistance } from '@/app/lib/deal-utils';

export type MiniDeal = {
  id: number;
  title: string;
  image?: string | null;
  category?: string | null;
  offer_price?: string | null;
  original_price?: string | null;
  rating?: number | null;
  area?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_boosted?: boolean | null;
};

export default function MiniDealCard({ deal, userLat, userLng }: {
  deal: MiniDeal;
  userLat?: number | null;
  userLng?: number | null;
}) {
  const pct = getDiscountPct(deal.offer_price, deal.original_price);
  const distanceLabel =
    userLat != null && userLng != null && deal.latitude != null && deal.longitude != null
      ? formatDistance(haversineKm(userLat, userLng, deal.latitude, deal.longitude))
      : null;
  return (
    <Link
      href={`/deal/${deal.id}`}
      className="flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border border-white/8 bg-slate-900 active:scale-95 active:opacity-90 transition-all duration-150 select-none"
    >
      <div className="relative h-24 overflow-hidden bg-slate-800">
        {deal.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={deal.image} alt={deal.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">
            {getCategoryMeta(deal.category).emoji}
          </div>
        )}
        {pct !== null && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white leading-none">
            -{pct}%
          </span>
        )}
        {deal.is_boosted && (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-violet-500/90 px-1.5 py-0.5 text-[10px] font-extrabold text-white leading-none">
            ✦
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="line-clamp-2 text-[12px] font-bold leading-snug text-white">{deal.title}</p>
        <div className="mt-auto space-y-0.5 pt-2">
          {deal.offer_price && (
            <p className="text-[12px] font-extrabold text-violet-400">{deal.offer_price}</p>
          )}
          {(deal.rating || 0) > 0 && (
            <p className="text-[11px] font-semibold text-amber-400">★ {deal.rating?.toFixed(1)}</p>
          )}
          <p className="truncate text-[11px] text-slate-600">
            {distanceLabel && <span className="font-semibold text-emerald-400/80">📍 {distanceLabel}</span>}
            {distanceLabel && (deal.area || deal.city) ? ' · ' : ''}
            {deal.area || deal.city || ''}
          </p>
        </div>
      </div>
    </Link>
  );
}
