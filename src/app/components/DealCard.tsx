'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { MapPin, Eye, MousePointerClick, Navigation, Bookmark, BookmarkCheck, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';

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
  image?: string | null;
  rating?: number | null;
  rating_count?: number | null;
};

function locationLabel(deal: Deal): string {
  const parts = [deal.area, deal.city].filter(Boolean);
  if (parts.length) return parts.join(', ');
  if (deal.latitude && deal.longitude)
    return `${deal.latitude.toFixed(4)}, ${deal.longitude.toFixed(4)}`;
  return 'Location not set';
}

export default function DealCard({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [dirError, setDirError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const canNavigate = !!(deal.latitude && deal.longitude);
  const label = locationLabel(deal);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: existing } = await supabase
        .from('saved_deals')
        .select('id')
        .eq('user_id', data.user.id)
        .eq('deal_id', deal.id)
        .maybeSingle();
      if (existing) { setSaved(true); setSavedId(existing.id); }
    };
    init();
  }, [deal.id]);

  const toggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) { router.push('/user/login'); return; }
    if (saveLoading) return;
    setSaveLoading(true);
    if (saved && savedId) {
      await supabase.from('saved_deals').delete().eq('id', savedId);
      setSaved(false); setSavedId(null);
    } else {
      const { data } = await supabase
        .from('saved_deals')
        .insert({ user_id: userId, deal_id: deal.id })
        .select('id').single();
      if (data) { setSaved(true); setSavedId(data.id); }
    }
    setSaveLoading(false);
  };

  const openDeal = async () => {
    await supabase.from('deals').update({ views: (deal.views || 0) + 1 }).eq('id', deal.id);
    router.push(`/deal/${deal.id}`);
  };

  const openDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canNavigate) { setDirError(true); setTimeout(() => setDirError(false), 3000); return; }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`, '_blank');
  };

  const syncDealRating = async () => {
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('deal_id', deal.id);

    const count = allReviews?.length || 0;
    const avg = count
      ? allReviews!.reduce((sum, r) => sum + (r.rating || 0), 0) / count
      : 0;

    await supabase
      .from('deals')
      .update({ rating: avg || null, rating_count: count })
      .eq('id', deal.id);
  };

  const upsertReview = async (value: number, comment = '') => {
    if (!userId) { router.push('/user/login'); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('deal_id', deal.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('reviews')
          .update({ rating: value, comment: comment || null })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('reviews')
          .insert({ deal_id: deal.id, user_id: userId, rating: value, comment: comment || null });
      }

      await syncDealRating();
      setReviewOpen(false);
      setReviewComment('');
      setReviewRating(5);
      window.location.reload();
    } finally {
      setSubmitting(false);
    }
  };

  const submitRating = async (e: React.MouseEvent, value: number) => {
    e.stopPropagation();
    await upsertReview(value);
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertReview(reviewRating, reviewComment.trim());
  };

  return (
    <div
      onClick={openDeal}
      className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-2"
    >
      {deal.image ? (
        <img src={deal.image} alt={deal.title}
          className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110" />
      ) : (
        <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400 text-sm">
          No Image
        </div>
      )}

      <div className="p-4 relative">
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <button onClick={toggleSave}
            title={saved ? 'Remove from saved' : 'Save this deal'}
            className={`p-2 rounded-full shadow transition-all
              ${saved ? 'bg-emerald-500 text-white scale-110' : 'bg-white text-gray-400 hover:text-emerald-500 hover:scale-110'}`}
          >
            {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </button>

          <button onClick={openDirections}
            title={canNavigate ? 'Get directions' : 'No location saved'}
            className={`p-2 rounded-full shadow transition-all
              ${canNavigate ? 'bg-white hover:bg-purple-50 hover:text-purple-600 text-gray-500' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
          >
            <Navigation size={15} />
          </button>
        </div>

        <h3 className="font-semibold text-lg pr-16">{deal.title}</h3>
        <p className="text-gray-600 text-sm mt-1 line-clamp-2">{deal.description}</p>

        <div className="flex items-center gap-1 mt-2">
          <MapPin size={13} className={canNavigate ? 'text-purple-500 shrink-0' : 'text-gray-300 shrink-0'} />
          <p className={`text-sm truncate ${canNavigate ? 'text-gray-600' : 'text-gray-400 italic'}`}>{label}</p>
        </div>

        {dirError && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mt-1.5 border border-amber-200">
            📍 No location saved for this deal yet.
          </p>
        )}

        <p className="text-xs text-gray-400 mt-1">
          Valid till {deal.valid_till_date
            ? new Date(deal.valid_till_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'No expiry'}
        </p>

        <div className="flex items-center gap-0.5 mt-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onClick={(e) => submitRating(e, star)}
              className="text-lg hover:scale-125 transition-transform"
              style={{ color: star <= Math.round(deal.rating || 0) ? '#facc15' : '#e5e7eb' }}
            >★</button>
          ))}
          <span className="text-xs text-gray-500 ml-1.5">
            {deal.rating ? deal.rating.toFixed(1) : '0.0'} ({deal.rating_count || 0})
          </span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setReviewOpen(true); }}
          className="mt-2 text-xs text-purple-600 font-medium inline-flex items-center gap-1 hover:text-purple-700"
        >
          <MessageSquare size={13} />
          Write review
        </button>

        <div className="flex gap-4 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Eye size={13} /> {deal.views || 0}</span>
          <span className="flex items-center gap-1"><MousePointerClick size={13} /> {deal.clicks || 0}</span>
        </div>
      </div>

      {reviewOpen && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4" onClick={() => setReviewOpen(false)}>
          <form
            onSubmit={submitReview}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl"
          >
            <h4 className="text-base font-semibold">Add your review</h4>
            <p className="text-xs text-gray-500 mt-1 mb-3 line-clamp-1">{deal.title}</p>

            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setReviewRating(star)}
                  className="text-2xl leading-none"
                  style={{ color: star <= reviewRating ? '#facc15' : '#e5e7eb' }}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
              rows={4}
              maxLength={400}
              placeholder="Share your experience (optional)"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
            />

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                className="flex-1 border rounded-xl py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-purple-600 text-white rounded-xl py-2.5 text-sm disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
