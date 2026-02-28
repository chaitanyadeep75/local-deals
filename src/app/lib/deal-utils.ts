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
