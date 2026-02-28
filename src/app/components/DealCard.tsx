'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/app/lib/supabase';
import { MapPin, Eye, MousePointerClick, Navigation, Bookmark, BookmarkCheck, MessageSquare, ShieldCheck, Clock3, Phone, MessageCircleMore, Copy, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatOfferLine, getUrgencyLabel } from '@/app/lib/deal-utils';
import { trackEvent } from '@/app/lib/analytics';

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
  image_urls?: string[] | null;
  rating?: number | null;
  rating_count?: number | null;
  offer_price?: string | null;
  original_price?: string | null;
  discount_label?: string | null;
  coupon_code?: string | null;
  redemption_mode?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  is_verified?: boolean | null;
  updated_at?: string | null;
  status?: string | null;
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
  const pathname = usePathname();
  const [submitting, setSubmitting] = useState(false);
  const [dirError, setDirError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const canNavigate = !!(deal.latitude && deal.longitude);
  const label = locationLabel(deal);
  const urgency = getUrgencyLabel(deal.valid_till_date);
  const offerLine = formatOfferLine(deal.offer_price, deal.original_price, deal.discount_label);
  const imageGallery = useMemo(() => {
    const unique = new Set<string>();
    const urls = [...(deal.image_urls || []), deal.image || ''].filter(Boolean) as string[];
    return urls.filter((url) => {
      if (unique.has(url)) return false;
      unique.add(url);
      return true;
    });
  }, [deal.image, deal.image_urls]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [deal.id]);

  const loadSavedState = useCallback(async (uid: string) => {
    const { data: existing } = await supabase
      .from('saved_deals')
      .select('id')
      .eq('user_id', uid)
      .eq('deal_id', deal.id)
      .maybeSingle();
    if (existing) {
      setSaved(true);
      setSavedId(existing.id);
    } else {
      setSaved(false);
      setSavedId(null);
    }
  }, [deal.id]);

  const ensureUser = async () => {
    if (userId) return userId;
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData.session?.user?.id || null;
    if (sessionUserId) {
      setUserId(sessionUserId);
      return sessionUserId;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    setUserId(data.user.id);
    return data.user.id;
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id || null;
      setUserId(uid);
      if (uid) await loadSavedState(uid);
      else {
        setSaved(false);
        setSavedId(null);
      }
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (uid) {
        await loadSavedState(uid);
      } else {
        setSaved(false);
        setSavedId(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [deal.id, loadSavedState]);

  const toggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saveLoading) return;
    const uid = await ensureUser();
    if (!uid) {
      const next = encodeURIComponent(pathname || '/');
      router.push(`/user/login?next=${next}`);
      return;
    }
    setSaveLoading(true);
    try {
      if (saved && savedId) {
        await supabase.from('saved_deals').delete().eq('id', savedId);
        setSaved(false);
        setSavedId(null);
        void trackEvent('deal_unsaved', { deal_id: deal.id });
      } else {
        const { data, error } = await supabase
          .from('saved_deals')
          .insert({ user_id: uid, deal_id: deal.id })
          .select('id')
          .single();
        if (!error && data) {
          setSaved(true);
          setSavedId(data.id);
          void trackEvent('deal_saved', { deal_id: deal.id });
        }
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const openDeal = async () => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('ld_recent_viewed');
      const parsed = raw ? (JSON.parse(raw) as number[]) : [];
      const next = [deal.id, ...parsed.filter((id) => id !== deal.id)].slice(0, 12);
      window.localStorage.setItem('ld_recent_viewed', JSON.stringify(next));
    }
    void supabase
      .from('deals')
      .update({ views: (deal.views || 0) + 1 })
      .eq('id', deal.id);
    void trackEvent('deal_card_opened', { deal_id: deal.id });
    router.push(`/deal/${deal.id}`);
  };

  const getShareUrl = () => {
    if (typeof window === 'undefined') return `/deal/${deal.id}`;
    return `${window.location.origin}/deal/${deal.id}`;
  };

  const copyCoupon = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!deal.coupon_code) return;
    await navigator.clipboard.writeText(deal.coupon_code);
    void trackEvent('coupon_copied', { deal_id: deal.id });
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const openDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canNavigate) { setDirError(true); setTimeout(() => setDirError(false), 3000); return; }
    void trackEvent('directions_clicked', { deal_id: deal.id, surface: 'deal_card' });
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`, '_blank');
  };

  const shareDeal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getShareUrl();
    const text = `${deal.title} on LocalDeals`;
    if (navigator.share) {
      try {
        await navigator.share({ title: deal.title, text, url });
        void trackEvent('deal_shared', { deal_id: deal.id, channel: 'native' });
        return;
      } catch {
        // User canceled or browser blocked; fall back to copy.
      }
    }
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1200);
    void trackEvent('deal_shared', { deal_id: deal.id, channel: 'copy_fallback' });
  };

  const shareOnWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getShareUrl();
    const msg = encodeURIComponent(`Check this deal: ${deal.title}\n${url}`);
    void trackEvent('deal_shared', { deal_id: deal.id, channel: 'whatsapp' });
    window.open(`https://wa.me/?text=${msg}`, '_blank');
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
    const uid = await ensureUser();
    if (!uid) {
      const next = encodeURIComponent(pathname || '/');
      router.push(`/user/login?next=${next}`);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('deal_id', deal.id)
        .eq('user_id', uid)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('reviews')
          .update({ rating: value, comment: comment || null })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('reviews')
          .insert({ deal_id: deal.id, user_id: uid, rating: value, comment: comment || null });
      }

      await syncDealRating();
      setReviewOpen(false);
      setReviewComment('');
      setReviewRating(5);
    } finally {
      setSubmitting(false);
    }
  };

  const submitRating = async (e: React.MouseEvent, value: number) => {
    e.stopPropagation();
    void trackEvent('rating_submitted', { deal_id: deal.id, rating: value, source: 'quick_star' });
    await upsertReview(value);
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    void trackEvent('review_submitted', { deal_id: deal.id, rating: reviewRating });
    await upsertReview(reviewRating, reviewComment.trim());
  };

  return (
    <div
      onClick={openDeal}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-lg shadow-indigo-100/30 backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
    >
      {imageGallery.length ? (
        <div className="relative h-40 w-full overflow-hidden md:h-48">
          <Image
            src={imageGallery[activeImageIndex]}
            alt={deal.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
          {imageGallery.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((prev) => (prev - 1 + imageGallery.length) % imageGallery.length);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((prev) => (prev + 1) % imageGallery.length);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white"
              >
                <ChevronRight size={13} />
              </button>
              <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
                {activeImageIndex + 1}/{imageGallery.length}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm text-slate-400 md:h-48">
          No Image
        </div>
      )}

      <div className="relative p-3.5 md:p-4">
        <div className="absolute right-3 top-3 flex flex-col gap-1.5 md:right-4 md:top-4 md:gap-2">
          <button onClick={toggleSave}
            title={saved ? 'Remove from saved' : 'Save this deal'}
            className={`rounded-full p-1.5 shadow transition-all md:p-2
              ${saved ? 'bg-emerald-500 text-white scale-110' : 'bg-white text-gray-400 hover:text-emerald-500 hover:scale-110'}`}
          >
            {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          </button>

          <button onClick={openDirections}
            title={canNavigate ? 'Get directions' : 'No location saved'}
            className={`rounded-full p-1.5 shadow transition-all md:p-2
              ${canNavigate ? 'bg-white hover:bg-purple-50 hover:text-purple-600 text-gray-500' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
          >
            <Navigation size={14} />
          </button>
        </div>

        <h3 className="line-clamp-2 pr-12 text-base font-semibold leading-snug tracking-tight text-slate-900 md:pr-16 md:text-lg">
          {deal.title}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {deal.is_verified && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              <ShieldCheck size={11} /> Verified
            </span>
          )}
          {urgency && urgency !== 'Expired' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <Clock3 size={11} /> {urgency}
            </span>
          )}
          {deal.status === 'paused' && (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Paused</span>
          )}
        </div>
        <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-slate-600 md:text-sm">
          {deal.description}
        </p>
        {offerLine && <p className="mt-1 text-xs font-medium text-indigo-700">{offerLine}</p>}

        <div className="flex items-center gap-1 mt-2">
          <MapPin size={13} className={canNavigate ? 'text-purple-500 shrink-0' : 'text-gray-300 shrink-0'} />
          <p className={`truncate text-xs leading-tight md:text-sm ${canNavigate ? 'text-slate-600' : 'text-slate-400 italic'}`}>{label}</p>
        </div>

        {dirError && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mt-1.5 border border-amber-200">
            📍 No location saved for this deal yet.
          </p>
        )}

        <p className="mt-1 text-xs text-slate-400">
          Valid till {deal.valid_till_date
            ? new Date(deal.valid_till_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'No expiry'}
        </p>
        {deal.updated_at && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            Updated {new Date(deal.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
        )}

        <div className="mt-2 flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onClick={(e) => submitRating(e, star)}
              className="text-base transition-transform hover:scale-125 md:text-lg"
              style={{ color: star <= Math.round(deal.rating || 0) ? '#facc15' : '#e5e7eb' }}
            >★</button>
          ))}
          <span className="ml-1 text-xs text-slate-500 md:ml-1.5">
            {deal.rating ? deal.rating.toFixed(1) : '0.0'} ({deal.rating_count || 0})
          </span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setReviewOpen(true); }}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700"
        >
          <MessageSquare size={13} />
          Write review
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={shareDeal}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700"
          >
            <Share2 size={12} /> {shareCopied ? 'Link Copied' : 'Share'}
          </button>
          <button
            onClick={shareOnWhatsApp}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700"
          >
            <MessageCircleMore size={12} /> Share WhatsApp
          </button>
          {deal.coupon_code && (
            <button
              onClick={copyCoupon}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700"
            >
              <Copy size={12} /> {copied ? 'Copied' : `Copy ${deal.coupon_code}`}
            </button>
          )}
          {deal.contact_whatsapp && (
            <a
              onClick={(e) => e.stopPropagation()}
              href={`https://wa.me/${deal.contact_whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700"
            >
              <MessageCircleMore size={12} /> WhatsApp
            </a>
          )}
          {deal.contact_phone && (
            <a
              onClick={(e) => e.stopPropagation()}
              href={`tel:${deal.contact_phone}`}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700"
            >
              <Phone size={12} /> Call
            </a>
          )}
        </div>

        <div className="mt-2.5 flex gap-3 text-xs text-slate-400 md:mt-3 md:gap-4">
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
