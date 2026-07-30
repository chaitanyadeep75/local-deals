'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { supabase } from '@/app/lib/supabase';
import { getCategoryMeta, getCategoryLabel, normalizeCategory } from '@/app/lib/categories';
import {
  MapPin, Navigation, Star, ShieldCheck, Clock3, Copy, Phone,
  MessageCircleMore, ChevronLeft, ChevronRight, Flag, Store, Check, ArrowLeft,
  Bookmark, BookmarkCheck, Share2, Eye, Calendar, SearchX,
} from 'lucide-react';
import { formatOfferLine, getUrgencyLabel, haversineKm, formatDistance } from '@/app/lib/deal-utils';
import MiniDealCard from '@/app/components/MiniDealCard';
import { trackEvent } from '@/app/lib/analytics';
import { getOrCreateReferralCode, recordSignal } from '@/app/lib/growth';

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
  const [claiming, setClaiming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [similarDeals, setSimilarDeals] = useState<Deal[]>([]);
  const [incomingRef, setIncomingRef] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code) setIncomingRef(code);
  }, []);

  const loginRedirect = useMemo(() => {
    const next = incomingRef ? `/deal/${dealId}?ref=${encodeURIComponent(incomingRef)}` : `/deal/${dealId}`;
    return `/login?next=${encodeURIComponent(next)}`;
  }, [dealId, incomingRef]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('ld_last_coords');
      if (raw) {
        const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCoords({ lat: parsed.lat, lng: parsed.lng });
        }
      }
    } catch { /* best-effort */ }
  }, []);

  useEffect(() => {
    if (!userId || !dealId) { setSaved(false); setSavedId(null); return; }
    supabase
      .from('saved_deals')
      .select('id')
      .eq('user_id', userId)
      .eq('deal_id', dealId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setSaved(true); setSavedId(data.id); }
        else { setSaved(false); setSavedId(null); }
      });
  }, [userId, dealId]);

  useEffect(() => {
    if (!deal?.category || !dealId) { setSimilarDeals([]); return; }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('deals')
        .select('*')
        .neq('id', dealId)
        .order('created_at', { ascending: false })
        .limit(60);
      if (cancelled || !data) return;
      const today = new Date().toISOString().split('T')[0];
      const targetCat = normalizeCategory(deal.category);
      const candidates = (data as Deal[]).filter((d) =>
        normalizeCategory(d.category) === targetCat &&
        (!d.status || d.status === 'active') &&
        (!d.valid_till_date || d.valid_till_date >= today)
      );
      if (coords) {
        candidates.sort((a, b) => {
          const da = a.latitude != null && a.longitude != null
            ? haversineKm(coords.lat, coords.lng, a.latitude, a.longitude) : Number.MAX_VALUE;
          const db = b.latitude != null && b.longitude != null
            ? haversineKm(coords.lat, coords.lng, b.latitude, b.longitude) : Number.MAX_VALUE;
          return da - db;
        });
      } else {
        candidates.sort((a, b) => ((b.clicks || 0) + (b.views || 0)) - ((a.clicks || 0) + (a.views || 0)));
      }
      setSimilarDeals(candidates.slice(0, 8));
    };
    void load();
    return () => { cancelled = true; };
  }, [deal?.category, dealId, coords]);

  const toggleSave = async () => {
    if (!dealId || saveLoading) return;
    if (!userId) { router.push(loginRedirect); return; }
    setSaveLoading(true);
    try {
      if (saved && savedId) {
        await supabase.from('saved_deals').delete().eq('id', savedId);
        setSaved(false); setSavedId(null);
        void trackEvent('deal_unsaved', { deal_id: dealId, surface: 'deal_detail' });
      } else {
        const { data, error } = await supabase
          .from('saved_deals')
          .insert({ user_id: userId, deal_id: dealId })
          .select('id')
          .single();
        if (!error && data) {
          setSaved(true); setSavedId(data.id);
          recordSignal({ userId, signalType: 'save', dealId, category: deal?.category, city: deal?.city, area: deal?.area, score: 3 });
          void trackEvent('deal_saved', { deal_id: dealId, surface: 'deal_detail' });
        }
      }
    } finally { setSaveLoading(false); }
  };

  const shareDeal = async () => {
    if (!deal) return;
    let url = `${window.location.origin}/deal/${deal.id}`;
    if (userId) {
      try {
        const code = await getOrCreateReferralCode(userId, 'deal_share');
        url += `?ref=${encodeURIComponent(code)}`;
      } catch { /* share the plain link if referral lookup fails */ }
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: deal.title, text: `${deal.title} on LocalDeals`, url });
        void trackEvent('deal_shared', { deal_id: deal.id, channel: 'native', surface: 'deal_detail' });
        return;
      } catch { /* fall through to clipboard */ }
    }
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
    void trackEvent('deal_shared', { deal_id: deal.id, channel: 'copy_fallback', surface: 'deal_detail' });
  };

  const isAbortError = (error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError') return true;
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
      const [
        { data: dealData, error: dealError },
        { data: reviewData, error: reviewError },
        { data: authData, error: authError },
      ] = await Promise.all([
        supabase.from('deals').select('*').eq('id', dealId).abortSignal(signal ?? new AbortController().signal).maybeSingle(),
        supabase.from('reviews').select('id, user_id, deal_id, rating, comment, created_at').eq('deal_id', dealId).order('created_at', { ascending: false }).abortSignal(signal ?? new AbortController().signal),
        supabase.auth.getUser(),
      ]);

      if (dealError) throw dealError;
      if (reviewError) throw reviewError;
      if (signal?.aborted) return;

      setDeal((dealData as Deal | null) || null);
      setReviews((reviewData as Review[] | null) || []);

      const uid = authError ? null : (authData.user?.id || null);
      setUserId(uid);

      if (uid && dealData) {
        recordSignal({
          userId: uid, signalType: 'view', dealId: (dealData as Deal).id,
          category: (dealData as Deal).category, city: (dealData as Deal).city, area: (dealData as Deal).area,
          score: 1,
        });
      }

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
    const { data } = await supabase.from('reviews').select('rating').eq('deal_id', dealId);
    const count = data?.length || 0;
    const avg = count ? data!.reduce((sum, r) => sum + (r.rating || 0), 0) / count : null;
    await supabase.from('deals').update({ rating: avg, rating_count: count }).eq('id', dealId);
  };

  const submitReview = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!dealId) return;
    if (!userId) { router.push(loginRedirect); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: existing } = await supabase.from('reviews').select('id').eq('deal_id', dealId).eq('user_id', userId).maybeSingle();
      if (existing?.id) {
        await supabase.from('reviews').update({ rating: myRating, comment: myComment.trim() || null }).eq('id', existing.id);
      } else {
        await supabase.from('reviews').insert({ deal_id: dealId, user_id: userId, rating: myRating, comment: myComment.trim() || null });
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
    void supabase.from('deals').update({ clicks: (deal.clicks || 0) + 1 }).eq('id', deal.id);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`, '_blank');
    setDeal({ ...deal, clicks: (deal.clicks || 0) + 1 });
  };

  const copyCoupon = async () => {
    if (!deal?.coupon_code) return;
    await navigator.clipboard.writeText(deal.coupon_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const submitClaim = async () => {
    if (!dealId || !deal) return;
    if (!userId) { router.push(loginRedirect); return; }
    setClaiming(true);
    const claim = await supabase.from('business_claims').insert({
      deal_id: dealId,
      claimant_user_id: userId,
      business_name: deal.title,
      phone: deal.contact_phone || null,
      status: 'pending',
    });
    setClaiming(false);
    if (claim.error) setErrorMsg(claim.error.message);
    else setErrorMsg('Claim submitted. We will verify ownership and unlock business access.');
  };

  const reportDeal = async () => {
    if (!dealId || !userId) { router.push(loginRedirect); return; }
    setReporting(true);
    const report = await supabase.from('abuse_reports').insert({
      reporter_user_id: userId,
      deal_id: dealId,
      reason: 'suspicious_or_incorrect',
    });
    setReporting(false);
    if (report.error) setErrorMsg(report.error.message);
    else setErrorMsg('Report submitted. Thanks for helping keep LocalDeals safe.');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 pb-16">
        <div className="max-w-4xl mx-auto px-3 py-5 md:px-6 md:py-8 animate-pulse">
          <div className="h-4 w-28 rounded-full bg-slate-800/80 mb-4" />
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-slate-900/80">
            <div className="h-64 w-full md:h-80 bg-slate-800/80" />
            <div className="p-5 md:p-7 space-y-4">
              <div className="h-7 w-3/4 rounded-lg bg-slate-800/80" />
              <div className="flex gap-2">
                <div className="h-5 w-20 rounded-full bg-slate-800/80" />
                <div className="h-5 w-16 rounded-full bg-slate-800/80" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-slate-800/60" />
                <div className="h-3 w-5/6 rounded bg-slate-800/60" />
              </div>
              <div className="flex gap-2">
                <div className="h-10 w-36 rounded-xl bg-slate-800/80" />
                <div className="h-10 w-24 rounded-xl bg-slate-800/80" />
                <div className="h-10 w-24 rounded-xl bg-slate-800/80" />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!deal) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 md:px-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center rounded-3xl border border-white/8 bg-slate-900/80 px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800/80 text-slate-500">
            <SearchX size={26} />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">Deal not found</h1>
          <p className="mt-1.5 text-sm text-slate-400 max-w-xs">
            This deal may have expired or been removed.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 shadow-neon-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
          >
            <ArrowLeft size={14} /> Back to deals
          </Link>
        </div>
      </main>
    );
  }

  const dealImages = [...new Set([...(deal.image_urls || []), deal.image || ''].filter(Boolean))] as string[];
  const offerLine = formatOfferLine(deal.offer_price, deal.original_price, deal.discount_label);
  const urgency = getUrgencyLabel(deal.valid_till_date);
  const catMeta = getCategoryMeta(deal.category);
  const catLabel = getCategoryLabel(deal.category);

  return (
    <main className="min-h-screen bg-slate-950 pb-16">
      <div className="max-w-4xl mx-auto px-3 py-5 md:px-6 md:py-8">

        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full text-sm text-slate-400 hover:text-slate-200 transition mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        >
          <ArrowLeft size={15} /> Back to deals
        </Link>

        {errorMsg && (
          <p className="mb-4 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
            {errorMsg}
          </p>
        )}

        {/* Main card */}
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-slate-900/80 shadow-card">

          {/* Image carousel */}
          {dealImages.length > 0 ? (
            <div className="relative h-64 w-full md:h-80 overflow-hidden bg-slate-800">
              <Image
                src={dealImages[activeImageIndex]}
                alt={deal.title}
                fill
                sizes="(max-width: 768px) 100vw, 1024px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />

              {dealImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveImageIndex((prev) => (prev - 1 + dealImages.length) % dealImages.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 backdrop-blur-sm p-2 text-white transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveImageIndex((prev) => (prev + 1) % dealImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 backdrop-blur-sm p-2 text-white transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    aria-label="Next image"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {dealImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImageIndex(i)}
                        aria-label={`Show image ${i + 1} of ${dealImages.length}`}
                        className={`rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${i === activeImageIndex ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/60'}`}
                      />
                    ))}
                  </div>
                </>
              )}

              {deal.category && (
                <div className="absolute top-3 left-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ${catMeta.bg} ${catMeta.color}`}>
                    <span>{catMeta.emoji}</span> {catLabel}
                  </span>
                </div>
              )}

              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-amber-400">
                  <Star size={11} fill="currentColor" />
                  {deal.rating?.toFixed(1) || '0.0'}
                  <span className="text-white/50 ml-0.5">({deal.rating_count || 0})</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="h-32 w-full bg-slate-800/80 border-b border-white/5 flex items-center justify-center">
              <span className="text-7xl opacity-60">{catMeta.emoji}</span>
            </div>
          )}

          <div className="p-5 md:p-7">

            {/* Title + badges */}
            <h1 className="text-2xl font-extrabold tracking-tight text-white leading-tight md:text-3xl">{deal.title}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {!dealImages.length && deal.category && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${catMeta.bg} ${catMeta.color}`}>
                  <span>{catMeta.emoji}</span> {catLabel}
                </span>
              )}
              {deal.is_verified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                  <ShieldCheck size={11} /> Verified
                </span>
              )}
              {urgency && urgency !== 'Expired' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
                  <Clock3 size={11} /> {urgency}
                </span>
              )}
              {urgency === 'Expired' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-medium text-rose-400">
                  Expired
                </span>
              )}
            </div>

            {/* Description */}
            <p className="mt-4 text-slate-300 text-sm leading-relaxed whitespace-pre-line break-words md:text-base">
              {deal.description}
            </p>

            {/* Pricing / Coupon card */}
            {(offerLine || deal.coupon_code) && (
              <div className="mt-5 rounded-2xl border border-violet-500/20 bg-slate-800/80 p-4">
                {offerLine && (
                  <p className="font-semibold text-violet-300 text-base">{offerLine}</p>
                )}
                {deal.coupon_code && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 rounded-xl border border-dashed border-violet-500/40 bg-violet-500/10 px-4 py-2.5 min-w-0">
                      <p className="text-[10px] text-violet-400 uppercase tracking-wider font-semibold mb-0.5">Coupon Code</p>
                      <p className="font-mono font-bold text-white tracking-widest text-sm truncate">{deal.coupon_code}</p>
                    </div>
                    <button
                      onClick={copyCoupon}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
                        copied
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-violet-600 text-white hover:bg-violet-500'
                      }`}
                    >
                      {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={openDirections}
                disabled={!deal.latitude || !deal.longitude}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition shadow-neon-violet disabled:opacity-40 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
              >
                <Navigation size={14} /> Get Directions
              </button>
              <button
                onClick={toggleSave}
                disabled={saveLoading}
                aria-label={saved ? 'Remove from saved deals' : 'Save deal'}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
                  saved
                    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {saved ? <><BookmarkCheck size={14} /> Saved</> : <><Bookmark size={14} /> Save</>}
              </button>
              <button
                onClick={shareDeal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
              >
                <Share2 size={14} /> {shareCopied ? 'Link copied!' : 'Share'}
              </button>
              {deal.contact_whatsapp && (
                <a
                  href={`https://wa.me/${deal.contact_whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/25 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                >
                  <MessageCircleMore size={14} /> WhatsApp
                </a>
              )}
              {deal.contact_phone && (
                <a
                  href={`tel:${deal.contact_phone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                >
                  <Phone size={14} /> Call
                </a>
              )}
            </div>

            {/* Meta info */}
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} className="text-violet-400" />
                {coords && deal.latitude != null && deal.longitude != null && (
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-px text-[11px] font-bold text-emerald-400">
                    {formatDistance(haversineKm(coords.lat, coords.lng, deal.latitude, deal.longitude))}
                  </span>
                )}
                {[deal.area, deal.city].filter(Boolean).join(', ') || 'Location not set'}
              </span>
              <span className="inline-flex items-center gap-1.5"><Eye size={13} /> {deal.views || 0} views</span>
              <span className="inline-flex items-center gap-1.5"><Navigation size={13} /> {deal.clicks || 0} directions</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={13} /> {deal.valid_till_date ? `Expires ${new Date(deal.valid_till_date).toLocaleDateString('en-IN')}` : 'No expiry'}
              </span>
            </div>

            {/* Terms */}
            {deal.terms && (
              <div className="mt-4 rounded-2xl border border-white/6 bg-white/3 px-4 py-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Terms & Conditions</p>
                <p className="text-xs text-slate-400 leading-relaxed">{deal.terms}</p>
              </div>
            )}

            {deal.redemption_mode && (
              <p className="mt-3 text-xs text-slate-500">
                Redemption: <span className="text-slate-400 font-medium capitalize">{deal.redemption_mode.replace('-', ' ')}</span>
              </p>
            )}

            {deal.updated_at && (
              <p className="mt-2 text-[11px] text-slate-600">
                Last updated: {new Date(deal.updated_at).toLocaleString('en-IN')}
              </p>
            )}

            {/* Secondary actions */}
            <div className="mt-5 pt-4 border-t border-white/6 flex flex-wrap gap-2">
              <button
                onClick={submitClaim}
                disabled={claiming}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-slate-200 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
              >
                <Store size={12} /> {claiming ? 'Submitting...' : 'Claim this business'}
              </button>
              <button
                onClick={reportDeal}
                disabled={reporting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                <Flag size={12} /> {reporting ? 'Reporting...' : 'Report deal'}
              </button>
            </div>
          </div>
        </div>

        {/* More like this nearby */}
        {similarDeals.length > 0 && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {catMeta.emoji} More {catLabel} deals{coords ? ' near you' : ''}
              </h2>
              <span className="text-xs text-slate-500">{similarDeals.length} deals</span>
            </div>
            <div className="relative -mx-3 md:-mx-6">
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex gap-3 px-3 md:px-6" style={{ width: 'max-content' }}>
                  {similarDeals.map((d, i) => (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.05 }}
                    >
                      <MiniDealCard deal={d} userLat={coords?.lat} userLng={coords?.lng} />
                    </motion.div>
                  ))}
                  <div className="w-2 shrink-0" />
                </div>
              </div>
              <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-slate-950 to-transparent" />
            </div>
          </section>
        )}

        {/* Write review */}
        <div className="mt-6 rounded-2xl border border-white/8 bg-slate-900/80 p-5 md:p-7">
          <h2 className="text-base font-semibold text-white mb-1 md:text-lg">Write a Review</h2>
          <p className="text-xs text-slate-500 mb-4">
            {userId ? 'Share your experience with this deal.' : 'Sign in to leave a review.'}
          </p>
          <form onSubmit={submitReview}>
            <div className="flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setMyRating(star)}
                  aria-label={`Rate ${star} out of 5 stars`}
                  className="rounded-full text-3xl transition-transform hover:scale-125 leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                  style={{ color: star <= myRating ? '#f59e0b' : '#1e293b' }}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 text-sm text-slate-400">{myRating}/5</span>
            </div>

            <textarea
              rows={4}
              maxLength={400}
              value={myComment}
              onChange={(e) => setMyComment(e.target.value)}
              placeholder="Share your experience (optional)"
              className="w-full rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 leading-relaxed outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition resize-none"
            />

            <button
              type="submit"
              disabled={submitting}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
            >
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
          </form>
        </div>

        {/* Reviews list */}
        <div className="mt-4 rounded-2xl border border-white/8 bg-slate-900/80 p-5 md:p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white md:text-lg">
              Reviews
              {reviews.length > 0 && (
                <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400">
                  {reviews.length}
                </span>
              )}
            </h2>
            {deal.rating ? (
              <div className="flex items-center gap-1.5">
                <Star size={15} fill="#f59e0b" className="text-amber-400" />
                <span className="font-semibold text-white">{deal.rating.toFixed(1)}</span>
                <span className="text-slate-500 text-xs">/ 5</span>
              </div>
            ) : null}
          </div>

          {reviews.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/80 text-slate-500">
                <MessageCircleMore size={22} />
              </div>
              <p className="text-slate-400 text-sm">No reviews yet.</p>
              <p className="text-slate-500 text-xs mt-0.5">Be the first to share your experience.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review, i) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.05 }}
                  className="rounded-2xl border border-white/6 bg-slate-800/40 p-4"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-violet-600/80 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {review.user_id.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} style={{ color: s <= review.rating ? '#f59e0b' : '#1e293b' }} className="text-lg leading-none">★</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs text-slate-500">{new Date(review.created_at).toLocaleDateString('en-IN')}</span>
                      <button
                        onClick={async () => {
                          if (!userId) { router.push(loginRedirect); return; }
                          await supabase.from('abuse_reports').insert({
                            reporter_user_id: userId,
                            review_id: review.id,
                            reason: 'review_abuse_or_spam',
                          });
                        }}
                        aria-label="Report review"
                        title="Report review"
                        className="rounded-full text-slate-600 hover:text-rose-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                      >
                        <Flag size={12} />
                      </button>
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line break-words line-clamp-4 mt-1">
                      {review.comment}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
