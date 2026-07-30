import { supabase } from '@/app/lib/supabase';

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

type SignalInput = {
  userId: string;
  signalType: 'view' | 'save' | 'click' | 'unsave';
  dealId?: number | null;
  category?: string | null;
  city?: string | null;
  area?: string | null;
  score?: number;
};

/**
 * Fire-and-forget write of a behavior signal. Never throws — this is a
 * best-effort tracking call and should never block or break the UI action
 * it's attached to.
 */
export function recordSignal(input: SignalInput): void {
  void supabase.from('user_behavior_signals').insert({
    user_id: input.userId,
    signal_type: input.signalType,
    deal_id: input.dealId ?? null,
    category: input.category ?? null,
    city: input.city ?? null,
    area: input.area ?? null,
    score: input.score ?? 1,
  }).then(({ error }) => {
    if (error) console.warn('[recordSignal] insert failed:', error.message);
  });
}

/**
 * Recency-weighted category affinity for a user, most-affine first.
 * Used to personalize the "Personalized" feed beyond onboarding picks.
 */
export async function getTopCategoryAffinity(userId: string, sampleSize = 300): Promise<string[]> {
  const { data } = await supabase
    .from('user_behavior_signals')
    .select('category, score, created_at')
    .eq('user_id', userId)
    .not('category', 'is', null)
    .order('created_at', { ascending: false })
    .limit(sampleSize);

  if (!data || !data.length) return [];

  const now = Date.now();
  const weights = new Map<string, number>();
  for (const row of data) {
    if (!row.category) continue;
    const ageDays = (now - new Date(row.created_at).getTime()) / 86_400_000;
    const decay = Math.exp(-ageDays / 14); // ~2 week half-life
    weights.set(row.category, (weights.get(row.category) || 0) + (row.score || 1) * decay);
  }
  return [...weights.entries()].sort((a, b) => b[1] - a[1]).map(([category]) => category);
}

export function generateReferralCode(seed: string): string {
  const base = seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'LOCAL';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${suffix}`;
}

const REFERRAL_REWARD_POINTS = 20;

/**
 * Returns a reusable referral code for this user+source, creating one
 * (backed by a pending user_referrals row) only if no unconverted one exists yet.
 */
export async function getOrCreateReferralCode(userId: string, source = 'share'): Promise<string> {
  const { data: existing } = await supabase
    .from('user_referrals')
    .select('referral_code')
    .eq('inviter_user_id', userId)
    .eq('source', source)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.referral_code) return existing.referral_code;

  const code = generateReferralCode(userId);
  await supabase.from('user_referrals').insert({
    inviter_user_id: userId,
    referral_code: code,
    source,
    reward_points: 0,
    status: 'pending',
  });
  return code;
}

/**
 * Attributes a new signup to the referral code it arrived with, if that
 * code still points to an unconverted invite. Safe to call unconditionally
 * on every signup — a no-op when there's no matching code.
 */
export async function attributeReferral(referralCode: string, inviteeUserId: string): Promise<boolean> {
  const { data: row } = await supabase
    .from('user_referrals')
    .select('id, inviter_user_id')
    .eq('referral_code', referralCode)
    .eq('status', 'pending')
    .is('invitee_user_id', null)
    .maybeSingle();

  if (!row || row.inviter_user_id === inviteeUserId) return false;

  await supabase
    .from('user_referrals')
    .update({
      invitee_user_id: inviteeUserId,
      status: 'converted',
      converted_at: new Date().toISOString(),
      reward_points: REFERRAL_REWARD_POINTS,
    })
    .eq('id', row.id);
  return true;
}
