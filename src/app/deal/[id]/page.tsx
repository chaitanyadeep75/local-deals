'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { MapPin, Navigation, Star } from 'lucide-react';

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
  rating: number | null;
  rating_count: number | null;
  category: string | null;
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
      router.push('/user/login');
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
    await supabase.from('deals').update({ clicks: (deal.clicks || 0) + 1 }).eq('id', deal.id);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`, '_blank');
    setDeal({ ...deal, clicks: (deal.clicks || 0) + 1 });
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-sm text-purple-600 font-medium">← Back to deals</Link>
        {errorMsg && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{errorMsg}</p>
        )}

        <div className="mt-4 bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          {deal.image ? (
            <img src={deal.image} alt={deal.title} className="w-full h-72 object-cover" />
          ) : (
            <div className="w-full h-72 bg-gray-100" />
          )}

          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{deal.title}</h1>
                {deal.category && (
                  <span className="inline-block mt-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full capitalize">{deal.category}</span>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-amber-500">★ {deal.rating?.toFixed(1) || '0.0'}</p>
                <p className="text-xs text-gray-500">{deal.rating_count || 0} reviews</p>
              </div>
            </div>

            <p className="mt-4 text-gray-700">{deal.description}</p>

            <div className="mt-4 text-sm text-gray-600 flex flex-wrap gap-4">
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {[deal.area, deal.city].filter(Boolean).join(', ') || 'Location not set'}</span>
              <span>Views: {deal.views || 0}</span>
              <span>Clicks: {deal.clicks || 0}</span>
              <span>Valid till: {deal.valid_till_date ? new Date(deal.valid_till_date).toLocaleDateString('en-IN') : 'No expiry'}</span>
            </div>

            <button
              onClick={openDirections}
              disabled={!deal.latitude || !deal.longitude}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm disabled:opacity-50"
            >
              <Navigation size={15} /> Get Directions
            </button>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Write a review</h2>
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
              className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
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

        <div className="mt-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Recent reviews</h2>

          {reviews.length === 0 ? (
            <p className="text-sm text-gray-500">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border border-gray-100 rounded-xl p-4">
                  <p className="text-amber-500 text-sm inline-flex items-center gap-1">
                    <Star size={13} fill="currentColor" /> {review.rating}/5
                  </p>
                  {review.comment && <p className="text-sm text-gray-700 mt-1">{review.comment}</p>}
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
