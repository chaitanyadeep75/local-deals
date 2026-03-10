type DealQualityInput = {
  title?: string | null;
  description?: string | null;
  valid_till_date?: string | null;
  category?: string | null;
  image?: string | null;
  image_urls?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  offer_price?: string | null;
  original_price?: string | null;
  discount_label?: string | null;
  terms?: string | null;
  contact_phone?: string | null;
};

export function computeDealQuality(input: DealQualityInput): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  if ((input.title || '').trim().length >= 8) score += 10;
  else flags.push('title_short');

  if ((input.description || '').trim().length >= 30) score += 15;
  else flags.push('description_short');

  const images = [...(input.image_urls || []), input.image || ''].filter(Boolean);
  if (images.length >= 1) score += 20;
  else flags.push('missing_image');

  if (images.length >= 3) score += 8;

  if (input.valid_till_date) score += 10;
  else flags.push('missing_expiry');

  if (input.category) score += 8;
  else flags.push('missing_category');

  if (input.latitude !== null && input.latitude !== undefined && input.longitude !== null && input.longitude !== undefined) score += 15;
  else flags.push('missing_location');

  if ((input.offer_price || '').trim() || (input.original_price || '').trim() || (input.discount_label || '').trim()) score += 8;
  else flags.push('missing_offer');

  if ((input.terms || '').trim().length >= 8) score += 3;
  if ((input.contact_phone || '').trim().length >= 8) score += 3;

  return { score: Math.max(0, Math.min(100, score)), flags };
}

export function generateReferralCode(seed: string): string {
  const base = seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'LOCAL';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${suffix}`;
}
