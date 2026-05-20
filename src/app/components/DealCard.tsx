'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/app/lib/supabase';
import {
  MapPin, Eye, MousePointerClick, Navigation, Bookmark, BookmarkCheck,
  MessageSquare, ShieldCheck, Clock3, Phone, MessageCircleMore, Copy,
  Share2, ChevronLeft, ChevronRight, Flame, Zap, Sparkles, Rocket, X,
} from 'lucide-react';
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
  category?: string | null;
  coupon_code?: string | null;
  redemption_mode?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  is_verified?: boolean | null;
  updated_at?: string | null;
  status?: string | null;
  created_at?: string | null;
  is_boosted?: boolean | null;
  boost_until?: string | null;
};

function locationLabel(deal: Deal): string {
  const parts = [deal.area, deal.city].filter(Boolean);
  if (parts.length) return parts.join(', ');
  if (deal.latitude && deal.longitude)
    return `${deal.latitude.toFixed(4)}, ${deal.longitude.toFixed(4)}`;
  return 'Location not set';
}

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function getDiscountPct(offerPrice?: string | null, originalPrice?: string | null): number | null {
  if (!offerPrice || !originalPrice) return null;
  const offer = parseFloat(offerPrice.replace(/[^\d.]/g, ''));
  const orig = parseFloat(originalPrice.replace(/[^\d.]/g, ''));
  if (!orig || !offer || offer >= orig) return null;
  return Math.round(((orig - offer) / orig) * 100);
}

type HeatBadge = { label: string; className: string; icon: React.ReactNode };

function getHeatBadge(deal: Deal): HeatBadge | null {
  const now = Date.now();
  if (deal.is_boosted && deal.boost_until && new Date(deal.boost_until).getTime() > now) {
    return {
      label: 'Boosted',
      className: 'bg-fuchsia-500/90 text-white shadow-neon-fuchsia border border-fuchsia-400/30',
      icon: <Rocket size={10} />,
    };
  }
  if ((deal.clicks || 0) > 30) {
    return {
      label: 'Trending',
      className: 'bg-orange-500/90 text-white shadow-[0_0_12px_rgba(249,115,22,0.5)] border border-orange-400/30',
      icon: <Flame size={10} />,
    };
  }
  if (deal.valid_till_date) {
    const diff = new Date(deal.valid_till_date).getTime() - now;
    if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
      return {
        label: 'Ending Soon',
        className: 'bg-rose-500/90 text-white shadow-neon-rose border border-rose-400/30',
        icon: <Zap size={10} />,
      };
    }
  }
  if (deal.created_at && now - new Date(deal.created_at).getTime() < 3 * 24 * 60 * 60 * 1000) {
    return {
      label: 'New',
      className: 'bg-violet-500/90 text-white shadow-neon-violet border border-violet-400/30',
      icon: <Sparkles size={10} />,
    };
  }
  return null;
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
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

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

  const heatBadge = mounted ? getHeatBadge(deal) : null;
  const discountPct = mounted ? getDiscountPct(deal.offer_price, deal.original_price) : null;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setActiveImageIndex(0); }, [deal.id]);

  useEffect(() => {
    if (!deal.valid_till_date) return;
    const update = () => {
      const diff = new Date(deal.valid_till_date!).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      if (diff > 24 * 60 * 60 * 1000) { setTimeLeft(null); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setTimeLeft(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deal.valid_till_date]);

  const loadSavedState = useCallback(async (uid: string) => {
    const { data: existing } = await supabase
      .from('saved_deals')
      .select('id')
      .eq('user_id', uid)
      .eq('deal_id', deal.id)
      .maybeSingle();
    if (existing) { setSaved(true); setSavedId(existing.id); }
    else { setSaved(false); setSavedId(null); }
  }, [deal.id]);

  const ensureUser = async () => {
    if (userId) return userId;
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData.session?.user?.id || null;
    if (sessionUserId) { setUserId(sessionUserId); return sessionUserId; }
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
      else { setSaved(false); setSavedId(null); }
    };
    init();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (uid) await loadSavedState(uid);
      else { setSaved(false); setSavedId(null); }
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
        setSaved(false); setSavedId(null);
        void trackEvent('deal_unsaved', { deal_id: deal.id });
      } else {
        const { data, error } = await supabase
          .from('saved_deals')
          .insert({ user_id: uid, deal_id: deal.id })
          .select('id')
          .single();
        if (!error && data) {
          setSaved(true); setSavedId(data.id);
          if (typeof window !== 'undefined' && deal.category) {
            const raw = window.localStorage.getItem('ld_saved_categories');
            const prev = raw ? (JSON.parse(raw) as string[]) : [];
            const next = Array.from(new Set([deal.category.toLowerCase(), ...prev])).slice(0, 12);
            window.localStorage.setItem('ld_saved_categories', JSON.stringify(next));
          }
          void trackEvent('deal_saved', { deal_id: deal.id });
        }
      }
    } finally { setSaveLoading(false); }
  };

  const openDeal = async () => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('ld_recent_viewed');
      const parsed = raw ? (JSON.parse(raw) as number[]) : [];
      const next = [deal.id, ...parsed.filter((id) => id !== deal.id)].slice(0, 12);
      window.localStorage.setItem('ld_recent_viewed', JSON.stringify(next));
    }
    void supabase.from('deals').update({ views: (deal.views || 0) + 1 }).eq('id', deal.id);
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
      } catch { /* fall through */ }
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
    const { data: allReviews } = await supabase.from('reviews').select('rating').eq('deal_id', deal.id);
    const count = allReviews?.length || 0;
    const avg = count ? allReviews!.reduce((sum, r) => sum + (r.rating || 0), 0) / count : 0;
    await supabase.from('deals').update({ rating: avg || null, rating_count: count }).eq('id', deal.id);
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
        .from('reviews').select('id').eq('deal_id', deal.id).eq('user_id', uid).maybeSingle();
      if (existing?.id) {
        await supabase.from('reviews').update({ rating: value, comment: comment || null }).eq('id', existing.id);
      } else {
        await supabase.from('reviews').insert({ deal_id: deal.id, user_id: uid, rating: value, comment: comment || null });
      }
      await syncDealRating();
      setReviewOpen(false); setReviewComment(''); setReviewRating(5);
    } finally { setSubmitting(false); }
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
    <>
      <div
        onClick={openDeal}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/8 bg-slate-900/95 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-violet-500/30 hover:shadow-card-hover"
      >
        {/* Subtle inner top highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Image */}
        {imageGallery.length ? (
          <div className="relative h-48 w-full overflow-hidden md:h-52">
            <Image
              src={imageGallery[activeImageIndex]}
              alt={deal.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />

            {/* Image overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/20" />

            {/* Discount badge */}
            {discountPct && (
              <span className="absolute left-3 top-3 flex items-center gap-1 rounded-xl bg-rose-500/90 px-2.5 py-1 text-xs font-extrabold text-white shadow-neon-rose backdrop-blur-sm border border-rose-400/30">
                {discountPct}% OFF
              </span>
            )}

            {/* Heat badge */}
            {heatBadge && (
              <span className={`absolute right-3 top-3 flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm ${heatBadge.className}`}>
                {heatBadge.icon} {heatBadge.label}
              </span>
            )}

            {/* Gallery nav */}
            {imageGallery.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={(e) => { e.stopPropagation(); setActiveImageIndex((p) => (p - 1 + imageGallery.length) % imageGallery.length); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/70"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={(e) => { e.stopPropagation(); setActiveImageIndex((p) => (p + 1) % imageGallery.length); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/70"
                >
                  <ChevronRight size={13} />
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                  {activeImageIndex + 1}/{imageGallery.length}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex h-48 w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 md:h-52">
            <div className="flex flex-col items-center gap-2 text-slate-600">
              <div className="h-10 w-10 rounded-xl bg-slate-700/60 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <span className="text-xs">No image</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="relative p-4 md:p-4.5">
          {/* Save + Directions FAB */}
          <div className="absolute right-3 top-3 flex flex-col gap-1.5 md:right-4 md:top-4">
            <button
              onClick={toggleSave}
              title={saved ? 'Remove from saved' : 'Save this deal'}
              className={`rounded-xl p-2 transition-all duration-200 ${
                saved
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 scale-110 shadow-neon-emerald'
                  : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-emerald-500/15 hover:text-emerald-400 hover:border-emerald-500/30'
              }`}
            >
              {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            </button>
            <button
              onClick={openDirections}
              title={canNavigate ? 'Get directions' : 'No location saved'}
              className={`rounded-xl p-2 transition-all duration-200 border ${
                canNavigate
                  ? 'bg-white/5 border-white/10 text-slate-500 hover:bg-violet-500/15 hover:text-violet-400 hover:border-violet-500/30'
                  : 'bg-slate-800/40 border-white/5 text-slate-700 cursor-not-allowed'
              }`}
            >
              <Navigation size={14} />
            </button>
          </div>

          {/* Title */}
          <h3 className="line-clamp-2 pr-14 text-[15px] font-bold leading-snug tracking-tight text-white md:text-base">
            {deal.title}
          </h3>

          {/* Chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {deal.is_verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <ShieldCheck size={9} /> Verified
              </span>
            )}
            {urgency && urgency !== 'Expired' && !timeLeft && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                <Clock3 size={9} /> {urgency}
              </span>
            )}
            {deal.status === 'paused' && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Paused</span>
            )}
          </div>

          {/* Countdown */}
          {timeLeft && timeLeft !== 'Expired' && (
            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2">
              <Zap size={12} className="animate-pulse text-rose-400 shrink-0" />
              <span className="font-mono text-xs font-bold text-rose-400">Ends in {timeLeft}</span>
            </div>
          )}

          {/* Description */}
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate-400">
            {deal.description}
          </p>

          {/* Offer line */}
          {offerLine && (
            <div className="mt-2.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-1.5">
              <p className="text-xs font-semibold text-violet-300">{offerLine}</p>
            </div>
          )}

          {/* Location */}
          <div className="mt-2.5 flex items-center gap-1.5">
            <MapPin size={12} className={canNavigate ? 'shrink-0 text-violet-400' : 'shrink-0 text-slate-700'} />
            <p className={`truncate text-xs ${canNavigate ? 'text-slate-400' : 'italic text-slate-600'}`}>{label}</p>
          </div>

          {dirError && (
            <p className="mt-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-400">
              No location saved for this deal yet.
            </p>
          )}

          {/* Validity */}
          <p className="mt-1 text-[11px] text-slate-600">
            Valid till{' '}
            {deal.valid_till_date
              ? new Date(deal.valid_till_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'No expiry'}
          </p>

          {/* Stars */}
          <div className="mt-2.5 flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={(e) => submitRating(e, star)}
                className="text-base transition-transform hover:scale-125 md:text-lg"
                style={{ color: star <= Math.round(deal.rating || 0) ? '#fbbf24' : '#1e293b' }}
              >
                ★
              </button>
            ))}
            <span className="ml-1.5 text-xs text-slate-500">
              {deal.rating ? deal.rating.toFixed(1) : '0.0'} ({deal.rating_count || 0})
            </span>
          </div>

          {/* Write review */}
          <button
            onClick={(e) => { e.stopPropagation(); setReviewOpen(true); }}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-violet-400"
          >
            <MessageSquare size={12} /> Write review
          </button>

          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              onClick={shareDeal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-400"
            >
              <Share2 size={11} /> {shareCopied ? 'Copied!' : 'Share'}
            </button>
            <button
              onClick={shareOnWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400"
            >
              <MessageCircleMore size={11} /> WhatsApp
            </button>
            {deal.coupon_code && (
              <button
                onClick={copyCoupon}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-400 transition-all hover:bg-amber-500/20"
              >
                <Copy size={11} /> {copied ? 'Copied!' : `${deal.coupon_code}`}
              </button>
            )}
            {deal.contact_whatsapp && (
              <a
                onClick={(e) => e.stopPropagation()}
                href={`https://wa.me/${deal.contact_whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400 transition-all hover:bg-emerald-500/20"
              >
                <MessageCircleMore size={11} /> WA
              </a>
            )}
            {deal.contact_phone && (
              <a
                onClick={(e) => e.stopPropagation()}
                href={`tel:${deal.contact_phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-all hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-400"
              >
                <Phone size={11} /> Call
              </a>
            )}
          </div>

          {/* Engagement */}
          <div className="mt-3 flex items-center gap-3 border-t border-white/5 pt-3 text-[11px] text-slate-600">
            <span className="flex items-center gap-1"><Eye size={11} /> {fmtNum(deal.views || 0)}</span>
            <span className="flex items-center gap-1"><MousePointerClick size={11} /> {fmtNum(deal.clicks || 0)}</span>
            {deal.updated_at && (
              <span className="ml-auto">
                {new Date(deal.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {reviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4 sm:items-center"
          onClick={() => setReviewOpen(false)}
        >
          <form
            onSubmit={submitReview}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-[0_24px_80px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <h4 className="font-bold text-white">Add Review</h4>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{deal.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5">
              {/* Star picker */}
              <div className="mb-4 flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setReviewRating(star)}
                    className="text-3xl transition-all duration-150 hover:scale-125"
                    style={{ color: star <= reviewRating ? '#fbbf24' : '#1e293b', filter: star <= reviewRating ? 'drop-shadow(0 0 6px rgba(251,191,36,0.6))' : 'none' }}
                  >
                    ★
                  </button>
                ))}
              </div>

              <textarea
                className="w-full resize-none rounded-xl border border-white/10 bg-slate-800/80 p-3.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                rows={4}
                maxLength={400}
                placeholder="Share your experience (optional)…"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
              <p className="mt-1 text-right text-[10px] text-slate-600">{reviewComment.length}/400</p>

              <div className="mt-3 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
