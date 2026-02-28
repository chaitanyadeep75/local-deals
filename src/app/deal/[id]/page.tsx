'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/app/lib/supabase';
import { MapPin, Navigation, Star, ShieldCheck, Clock3, Copy, Phone, MessageCircleMore, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatOfferLine, getUrgencyLabel } from '@/app/lib/deal-utils';

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
  image_urls?: string[] | null;
  rating: number | null;
  rating_count: number | null;
  category: string | null;
  offer_price: string | null;
  original_price: string | null;
  discount_label: string | null;
  coupon_code: string | null;
  terms: string | null;
  redemption_mode: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  is_verified: boolean | null;
  updated_at: string | null;
  status: string | null;
};

type Review = {
  id: number;
  user_id: string;
  deal_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
};

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams();

  const dealId = useMemo(() => {
    const raw = params?.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(id);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params]);

  const [deal, setDeal] = useState<Deal | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const isAbortError = (error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError') {
      return true;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const msg = String((error as { message?: string }).message || '').toLowerCase();
      return msg.includes('signal is aborted') || msg.includes('abort');
    }
    return false;
  };

  const fetchDealAndReviews = async (signal?: AbortSignal) => {
    if (!dealId) return;

    setErrorMsg(null);
    setLoading(true);
    try {
      const [{ data: dealData, error: dealError }, { data: reviewData, error: reviewError }, { data: authData, error: authError }] = await Promise.all([
        supabase.from('deals').select('*').eq('id', dealId).abortSignal(signal ?? new AbortController().signal).maybeSingle(),
        supabase.from('reviews').select('id, user_id, deal_id, rating, comment, created_at').eq('deal_id', dealId).order('created_at', { ascending: false }).abortSignal(signal ?? new AbortController().signal),
        supabase.auth.getUser(),
      ]);

      if (dealError) throw dealError;
      if (reviewError) throw reviewError;
      if (authError) throw authError;
      if (signal?.aborted) return;

      setDeal((dealData as Deal | null) || null);
      setReviews((reviewData as Review[] | null) || []);

      const uid = authData.user?.id || null;
      setUserId(uid);

      if (uid && reviewData) {
        const mine = reviewData.find((r) => r.user_id === uid);
        if (mine) {
          setMyRating(mine.rating);
          setMyComment(mine.comment || '');
        }
      }
    } catch (error) {
      if (!isAbortError(error)) {
        const message = typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: string }).message || 'Failed to load deal')
          : 'Failed to load deal';
        setErrorMsg(message);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDealAndReviews(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [deal?.id]);

  const syncDealRating = async () => {
    if (!dealId) return;

    const { data } = await supabase
      .from('reviews')
      .select('rating')
      .eq('deal_id', dealId);

    const count = data?.length || 0;
    const avg = count ? data!.reduce((sum, r) => sum + (r.rating || 0), 0) / count : null;

    await supabase
      .from('deals')
      .update({ rating: avg, rating_count: count })
      .eq('id', dealId);
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealId) return;
    if (!userId) {
      router.push(`/user/login?next=/deal/${dealId}`);
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    try {
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('deal_id', dealId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('reviews')
          .update({ rating: myRating, comment: myComment.trim() || null })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('reviews')
          .insert({ deal_id: dealId, user_id: userId, rating: myRating, comment: myComment.trim() || null });
      }

      await syncDealRating();
      await fetchDealAndReviews();
    } catch (error) {
      if (!isAbortError(error)) {
        const message = typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: string }).message || 'Failed to save review')
          : 'Failed to save review';
        setErrorMsg(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDirections = async () => {
    if (!deal || !deal.latitude || !deal.longitude) return;
    void supabase
      .from('deals')
      .update({ clicks: (deal.clicks || 0) + 1 })
      .eq('id', deal.id);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`, '_blank');
    setDeal({ ...deal, clicks: (deal.clicks || 0) + 1 });
  };

  const copyCoupon = async () => {
    if (!deal?.coupon_code) return;
    await navigator.clipboard.writeText(deal.coupon_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!deal) {
    return (
      <main className="min-h-screen px-6 py-10">
        <p className="text-gray-600">Deal not found.</p>
        <Link href="/" className="text-purple-600 text-sm mt-3 inline-block">← Back to deals</Link>
      </main>
    );
  }

  const dealImages = [...new Set([...(deal.image_urls || []), deal.image || ''].filter(Boolean))] as string[];
  const offerLine = formatOfferLine(deal.offer_price, deal.original_price, deal.discount_label);
  const urgency = getUrgencyLabel(deal.valid_till_date);

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-3 py-6 md:px-6 md:py-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-sm text-purple-600 font-medium">← Back to deals</Link>
        {errorMsg && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{errorMsg}</p>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
          {dealImages.length ? (
            <div className="relative h-56 w-full md:h-72">
              <Image
                src={dealImages[activeImageIndex]}
                alt={deal.title}
                fill
                sizes="(max-width: 768px) 100vw, 1024px"
                className="object-cover"
              />
              {dealImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveImageIndex((prev) => (prev - 1 + dealImages.length) % dealImages.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveImageIndex((prev) => (prev + 1) % dealImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white"
                    aria-label="Next image"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {activeImageIndex + 1}/{dealImages.length}
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="h-56 w-full bg-gray-100 md:h-72" />
          )}

          <div className="p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
              <div className="min-w-0">
                <h1 className="line-clamp-2 break-words text-xl font-bold leading-tight text-gray-900 md:text-2xl">{deal.title}</h1>
                {deal.category && (
                  <span className="inline-block mt-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full capitalize">{deal.category}</span>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {deal.is_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      <ShieldCheck size={11} /> Verified business
                    </span>
                  )}
                  {urgency && urgency !== 'Expired' && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      <Clock3 size={11} /> {urgency}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm text-amber-500">★ {deal.rating?.toFixed(1) || '0.0'}</p>
                <p className="text-xs text-gray-500">{deal.rating_count || 0} reviews</p>
              </div>
            </div>

            <p className="mt-4 whitespace-pre-line break-words text-sm leading-relaxed text-gray-700 md:text-base">{deal.description}</p>
            {offerLine && <p className="mt-2 text-sm font-medium text-indigo-700">{offerLine}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {deal.coupon_code && (
                <button onClick={copyCoupon} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                  <Copy size={12} /> {copied ? 'Copied' : `Copy ${deal.coupon_code}`}
                </button>
              )}
              {deal.contact_whatsapp && (
                <a href={`https://wa.me/${deal.contact_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <MessageCircleMore size={12} /> WhatsApp
                </a>
              )}
              {deal.contact_phone && (
                <a href={`tel:${deal.contact_phone}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  <Phone size={12} /> Call
                </a>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-600 md:gap-4 md:text-sm">
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {[deal.area, deal.city].filter(Boolean).join(', ') || 'Location not set'}</span>
              <span>Views: {deal.views || 0}</span>
              <span>Clicks: {deal.clicks || 0}</span>
              <span>Valid till: {deal.valid_till_date ? new Date(deal.valid_till_date).toLocaleDateString('en-IN') : 'No expiry'}</span>
            </div>
            {deal.terms && (
              <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Terms: {deal.terms}
              </p>
            )}
            {deal.updated_at && (
              <p className="mt-2 text-[11px] text-slate-400">
                Last updated: {new Date(deal.updated_at).toLocaleString('en-IN')}
              </p>
            )}

            <button
              onClick={openDirections}
              disabled={!deal.latitude || !deal.longitude}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm disabled:opacity-50"
            >
              <Navigation size={15} /> Get Directions
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-lg md:p-6">
          <h2 className="mb-4 text-base font-semibold md:text-lg">Write a review</h2>
          <form onSubmit={submitReview}>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setMyRating(star)}
                  className="text-2xl"
                  style={{ color: star <= myRating ? '#facc15' : '#e5e7eb' }}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              rows={4}
              maxLength={400}
              value={myComment}
              onChange={(e) => setMyComment(e.target.value)}
              placeholder="Share your experience (optional)"
              className="w-full rounded-xl border p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-500"
            />

            <button
              type="submit"
              disabled={submitting}
              className="mt-3 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>
          </form>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-lg md:p-6">
          <h2 className="mb-4 text-base font-semibold md:text-lg">Recent reviews</h2>

          {reviews.length === 0 ? (
            <p className="text-sm text-gray-500">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-gray-100 p-3 md:p-4">
                  <p className="text-amber-500 text-sm inline-flex items-center gap-1">
                    <Star size={13} fill="currentColor" /> {review.rating}/5
                  </p>
                  {review.comment && <p className="mt-1 line-clamp-4 whitespace-pre-line break-words text-sm leading-relaxed text-gray-700">{review.comment}</p>}
                  <p className="text-xs text-gray-400 mt-2">{new Date(review.created_at).toLocaleDateString('en-IN')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
