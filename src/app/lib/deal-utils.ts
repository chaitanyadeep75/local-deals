export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function getDiscountPct(offerPrice?: string | null, originalPrice?: string | null): number | null {
  if (!offerPrice || !originalPrice) return null;
  const offer = parseFloat(String(offerPrice).replace(/[^\d.]/g, ''));
  const orig = parseFloat(String(originalPrice).replace(/[^\d.]/g, ''));
  if (!orig || !offer || offer >= orig) return null;
  return Math.round(((orig - offer) / orig) * 100);
}

export function getUrgencyLabel(validTillDate: string | null): string | null {
  if (!validTillDate) return null;
  const now = new Date();
  const end = new Date(validTillDate);
  const diffMs = end.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Expired';
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day left';
  if (days <= 7) return `${days} days left`;
  return null;
}

export function formatOfferLine(offerPrice?: string | null, originalPrice?: string | null, discountLabel?: string | null): string {
  const bits = [offerPrice ? `Offer ${offerPrice}` : null, originalPrice ? `MRP ${originalPrice}` : null, discountLabel || null]
    .filter(Boolean);
  return bits.join(' · ');
}

export function computeDealHealth(deal: {
  image?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  valid_till_date?: string | null;
  offer_price?: string | null;
  original_price?: string | null;
}) {
  const checks = [
    !!deal.image,
    deal.latitude !== null && deal.longitude !== null,
    (deal.description || '').trim().length >= 30,
    !!deal.valid_till_date,
    !!(deal.offer_price || deal.original_price),
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}
