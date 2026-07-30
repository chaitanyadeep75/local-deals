'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, X, Shield, Flag, Store, Trash2, Star,
  Zap, AlertCircle, RotateCcw, Eye, TrendingUp,
  Users, Tag, CheckCircle2, Clock, Search, Play, Pause,
  Inbox, PackageOpen,
} from 'lucide-react';
import { BOOST_PLANS_CONFIG_KEY, getDefaultBoostPlans, parseBoostPlans, type BoostPlan } from '@/app/lib/monetization';
import { getCategoryMeta, getCategoryLabel } from '@/app/lib/categories';

type PermissionRow = {
  user_id: string;
  status: string;
  reason: string | null;
  created_at: string;
};

type ClaimRow = {
  id: number;
  deal_id: number;
  claimant_user_id: string;
  business_name: string | null;
  phone: string | null;
  status: string;
  created_at: string;
};

type DealRow = {
  id: number;
  title: string;
  status: string | null;
  is_verified: boolean | null;
  is_boosted: boolean | null;
  user_id: string;
  category: string | null;
  city: string | null;
  views: number;
  clicks: number;
  rating: number | null;
  updated_at: string | null;
};

type AdminTab = 'overview' | 'approvals' | 'claims' | 'deals' | 'pricing';

const TAB_CONFIG: { key: AdminTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'overview',   label: 'Overview',   icon: TrendingUp },
  { key: 'approvals',  label: 'Approvals',  icon: Store },
  { key: 'claims',     label: 'Claims',     icon: Flag },
  { key: 'deals',      label: 'Deals',      icon: Tag },
  { key: 'pricing',    label: 'Pricing',    icon: Zap },
];

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [pendingPermissions, setPendingPermissions] = useState<PermissionRow[]>([]);
  const [pendingClaims, setPendingClaims] = useState<ClaimRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [dealSearch, setDealSearch] = useState('');
  const [boostPlans, setBoostPlans] = useState<BoostPlan[]>(getDefaultBoostPlans());
  const [savingBoostPlans, setSavingBoostPlans] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingTotal = useMemo(
    () => pendingPermissions.length + pendingClaims.length,
    [pendingPermissions.length, pendingClaims.length],
  );

  const stats = useMemo(() => ({
    total:    deals.length,
    active:   deals.filter((d) => d.status !== 'paused').length,
    paused:   deals.filter((d) => d.status === 'paused').length,
    verified: deals.filter((d) => d.is_verified).length,
    boosted:  deals.filter((d) => d.is_boosted).length,
  }), [deals]);

  const flash = (text: string, ok = true) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 3000);
  };

  const loadData = async () => {
    setError(null);
    const [{ data: permRows }, { data: claimRows }, { data: dealRows }, { data: boostConfig }] = await Promise.all([
      supabase.from('business_permissions').select('user_id, status, reason, created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(100),
      supabase.from('business_claims').select('id, deal_id, claimant_user_id, business_name, phone, status, created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(100),
      supabase.from('deals').select('id, title, status, is_verified, is_boosted, user_id, category, city, views, clicks, rating, updated_at').order('updated_at', { ascending: false }).limit(200),
      supabase.from('admin_config').select('value').eq('key', BOOST_PLANS_CONFIG_KEY).maybeSingle(),
    ]);
    setPendingPermissions((permRows || []) as PermissionRow[]);
    setPendingClaims((claimRows || []) as ClaimRow[]);
    setDeals((dealRows || []) as DealRow[]);
    setBoostPlans(parseBoostPlans(boostConfig?.value));
  };

  useEffect(() => {
    const boot = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) { router.replace('/login'); return; }
      const role = user.user_metadata?.role;
      if (role === 'admin') {
        setIsAdmin(true);
      } else {
        const adminCheck = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
        setIsAdmin(!!adminCheck.data);
      }
      setReady(true);
    };
    void boot();
  }, [router]);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    void loadData();
  }, [ready, isAdmin]);

  const reviewPermission = async (row: PermissionRow, approve: boolean) => {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('business_permissions').upsert({
      user_id: row.user_id,
      status: approve ? 'approved' : 'rejected',
      reviewed_by: auth.user?.id || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reason: approve ? null : 'Rejected by admin',
    });
    flash(approve ? 'Business approved ✓' : 'Business rejected');
    void loadData();
  };

  const reviewClaim = async (row: ClaimRow, approve: boolean) => {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('business_claims').update({
      status: approve ? 'approved' : 'rejected',
      reviewed_by: auth.user?.id || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', row.id);
    if (approve) {
      await Promise.all([
        supabase.from('deals').update({ user_id: row.claimant_user_id, is_verified: true }).eq('id', row.deal_id),
        supabase.from('business_permissions').upsert({
          user_id: row.claimant_user_id, status: 'approved',
          reviewed_by: auth.user?.id || null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }),
      ]);
    }
    flash(approve ? 'Claim approved + deal verified ✓' : 'Claim rejected');
    void loadData();
  };

  const moderateDeal = async (deal: DealRow, action: 'pause' | 'resume' | 'verify' | 'unverify' | 'feature' | 'unfeature' | 'delete') => {
    const { data: auth } = await supabase.auth.getUser();
    if (action === 'delete') {
      if (!window.confirm(`Delete "${deal.title}"? This cannot be undone.`)) return;
      await supabase.from('deals').delete().eq('id', deal.id);
      flash(`"${deal.title}" deleted`);
      void loadData();
      return;
    }
    if (action === 'pause' || action === 'resume') {
      await supabase.from('deals').update({ status: action === 'pause' ? 'paused' : 'active' }).eq('id', deal.id);
    }
    if (action === 'verify' || action === 'unverify') {
      await supabase.from('deals').update({ is_verified: action === 'verify' }).eq('id', deal.id);
    }
    if (action === 'feature' || action === 'unfeature') {
      const until = action === 'feature' ? new Date(Date.now() + 7 * 86400000).toISOString() : null;
      await supabase.from('deals').update({ is_boosted: action === 'feature', boost_until: until }).eq('id', deal.id);
    }
    try {
      await supabase.from('deal_moderation_actions').insert({
        deal_id: deal.id,
        moderator_user_id: auth.user?.id || '00000000-0000-0000-0000-000000000000',
        action, reason: null,
      });
    } catch { /* table may not exist yet */ }
    flash(`Deal ${action}d ✓`);
    void loadData();
  };

  const updateBoostPlan = (days: number, field: 'price' | 'label', value: string) => {
    setBoostPlans((prev) => prev.map((plan) => {
      if (plan.days !== days) return plan;
      if (field === 'price') return { ...plan, price: Number(value) || 0 };
      return { ...plan, label: value };
    }));
  };

  const saveBoostPlans = async () => {
    setSavingBoostPlans(true); setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const plansToSave = parseBoostPlans(boostPlans);
    const { error: saveError } = await supabase.from('admin_config').upsert({
      key: BOOST_PLANS_CONFIG_KEY, value: plansToSave,
      updated_by: auth.user?.id || null, updated_at: new Date().toISOString(),
    });
    setSavingBoostPlans(false);
    if (saveError) {
      setError(saveError.message.includes('admin_config')
        ? 'admin_config table missing — run the SQL migration in Supabase.'
        : saveError.message);
      return;
    }
    setBoostPlans(plansToSave);
    flash('Pricing saved ✓');
  };

  const filteredDeals = useMemo(() => {
    if (!dealSearch.trim()) return deals;
    const q = dealSearch.toLowerCase();
    return deals.filter((d) => d.title.toLowerCase().includes(q) || d.city?.toLowerCase().includes(q));
  }, [deals, dealSearch]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-violet-500" />
          <p className="text-sm text-slate-500">Loading admin…</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 border border-rose-500/30">
            <Shield size={24} className="text-rose-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Access Denied</h2>
          <p className="mt-1 text-sm text-slate-500">This area is for admins only.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen pb-20">
      {/* Toast */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-2xl backdrop-blur-xl
              ${actionMsg.ok
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/15 text-rose-300'}`}
          >
            {actionMsg.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {actionMsg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-neon-violet">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">Admin Console</h1>
              <p className="text-xs text-slate-500">LocalDeals management</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => void loadData()}
          className="card-press flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        >
          <RotateCcw size={13} /> Refresh
        </button>
      </div>

      {/* Pending badge */}
      {pendingTotal > 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-400">
          <Clock size={13} className="shrink-0" />
          <span><span className="font-bold">{pendingTotal}</span> item{pendingTotal > 1 ? 's' : ''} waiting for review</span>
          <button onClick={() => setTab('approvals')} className="ml-auto rounded-lg text-xs font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">Review →</button>
        </div>
      )}

      {/* Tab nav */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-slate-900/60 p-1 [scrollbar-width:none]">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`card-press relative flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 md:text-sm
              ${tab === key ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-neon-violet' : 'text-slate-500 hover:text-slate-300'}`}>
            <Icon size={14} />
            {label}
            {key === 'approvals' && pendingPermissions.length > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                {pendingPermissions.length}
              </span>
            )}
            {key === 'claims' && pendingClaims.length > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                {pendingClaims.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-400">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  { label: 'Total Deals',  value: stats.total,    icon: Tag,         classes: 'bg-violet-500/15 border-violet-500/20 text-violet-400' },
                  { label: 'Active',       value: stats.active,   icon: CheckCircle2, classes: 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400' },
                  { label: 'Paused',       value: stats.paused,   icon: Clock,        classes: 'bg-amber-500/15 border-amber-500/20 text-amber-400' },
                  { label: 'Verified',     value: stats.verified, icon: Shield,       classes: 'bg-blue-500/15 border-blue-500/20 text-blue-400' },
                  { label: 'Boosted',      value: stats.boosted,  icon: Zap,          classes: 'bg-fuchsia-500/15 border-fuchsia-500/20 text-fuchsia-400' },
                ].map(({ label, value, icon: Icon, classes }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.05, ease: 'easeOut' }}
                    className="rounded-2xl border border-white/8 bg-slate-900/60 p-4"
                  >
                    <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl border ${classes}`}>
                      <Icon size={16} />
                    </div>
                    <p className="text-2xl font-extrabold tracking-tight text-white">{value}</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Quick pending summary */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Store size={14} className="text-violet-400" /> Pending Approvals</h3>
                    <button onClick={() => setTab('approvals')} className="rounded-lg text-xs font-semibold text-violet-400 hover:text-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">View all →</button>
                  </div>
                  {pendingPermissions.length === 0
                    ? <p className="flex items-center gap-1.5 text-xs text-slate-500"><CheckCircle2 size={13} className="text-emerald-500/60" /> All caught up!</p>
                    : pendingPermissions.slice(0, 3).map((r, i) => (
                      <motion.div
                        key={r.user_id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.05, ease: 'easeOut' }}
                        className="mb-1.5 flex items-center justify-between rounded-xl border border-white/5 bg-white/3 px-3 py-2 last:mb-0"
                      >
                        <p className="truncate font-mono text-xs text-slate-400">{r.user_id.slice(0, 16)}…</p>
                        <div className="ml-2 flex gap-1.5">
                          <button onClick={() => reviewPermission(r, true)} aria-label="Approve" className="card-press flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"><Check size={12} /></button>
                          <button onClick={() => reviewPermission(r, false)} aria-label="Reject" className="card-press flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"><X size={12} /></button>
                        </div>
                      </motion.div>
                    ))
                  }
                </div>
                <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Flag size={14} className="text-amber-400" /> Pending Claims</h3>
                    <button onClick={() => setTab('claims')} className="rounded-lg text-xs font-semibold text-amber-400 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">View all →</button>
                  </div>
                  {pendingClaims.length === 0
                    ? <p className="flex items-center gap-1.5 text-xs text-slate-500"><CheckCircle2 size={13} className="text-emerald-500/60" /> No pending claims!</p>
                    : pendingClaims.slice(0, 3).map((r, i) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.05, ease: 'easeOut' }}
                        className="mb-1.5 flex items-center justify-between rounded-xl border border-white/5 bg-white/3 px-3 py-2 last:mb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-300">{r.business_name || 'Unnamed'}</p>
                          <p className="text-[10px] text-slate-500">Deal #{r.deal_id}</p>
                        </div>
                        <div className="ml-2 flex gap-1.5">
                          <button onClick={() => reviewClaim(r, true)} aria-label="Approve" className="card-press flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"><Check size={12} /></button>
                          <button onClick={() => reviewClaim(r, false)} aria-label="Reject" className="card-press flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"><X size={12} /></button>
                        </div>
                      </motion.div>
                    ))
                  }
                </div>
              </div>

              {/* Top deals */}
              <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><TrendingUp size={14} className="text-emerald-400" /> Top Deals by Engagement</h3>
                {deals.length === 0 ? (
                  <div className="py-8 text-center">
                    <PackageOpen size={28} className="mx-auto mb-2 text-slate-600" />
                    <p className="text-sm text-slate-500">No deals yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...deals].sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks)).slice(0, 5).map((d, i) => {
                      const meta = getCategoryMeta(d.category);
                      return (
                        <motion.div
                          key={d.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.05, ease: 'easeOut' }}
                          className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/3 px-3 py-2.5"
                        >
                          <span className="text-lg">{meta.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-200">{d.title}</p>
                            <p className="text-xs text-slate-500">{d.city || 'No city'}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                            <span className="flex items-center gap-0.5"><Eye size={11} /> {d.views}</span>
                            <span className="flex items-center gap-0.5"><TrendingUp size={11} /> {d.clicks}</span>
                            {d.rating && <span className="flex items-center gap-0.5 text-amber-400"><Star size={11} fill="currentColor" /> {d.rating.toFixed(1)}</span>}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Approvals ── */}
          {tab === 'approvals' && (
            <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-4">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-white"><Store size={16} className="text-violet-400" /> Business Approvals</h2>
              {pendingPermissions.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-500/40" />
                  <p className="font-semibold text-slate-400">All caught up!</p>
                  <p className="mt-1 text-sm text-slate-500">No pending business approvals.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingPermissions.map((row, i) => (
                    <motion.div
                      key={row.user_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.05, ease: 'easeOut' }}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3"
                    >
                      <div>
                        <p className="font-mono text-sm font-medium text-slate-200">{row.user_id}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={10} /> Requested {new Date(row.created_at).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => reviewPermission(row, true)}
                          className="card-press flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
                          <Check size={12} /> Approve
                        </button>
                        <button onClick={() => reviewPermission(row, false)}
                          className="card-press flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
                          <X size={12} /> Reject
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Claims ── */}
          {tab === 'claims' && (
            <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-4">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-white"><Flag size={16} className="text-amber-400" /> Business Claims</h2>
              {pendingClaims.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-500/40" />
                  <p className="font-semibold text-slate-400">No pending claims.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingClaims.map((row, i) => (
                    <motion.div
                      key={row.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.05, ease: 'easeOut' }}
                      className="rounded-xl border border-white/8 bg-white/3 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-white">{row.business_name || 'Unnamed business'}</p>
                          <p className="mt-0.5 text-xs text-slate-500">Deal #{row.deal_id} · Claimant: <span className="font-mono">{row.claimant_user_id.slice(0, 12)}…</span></p>
                          {row.phone && <p className="text-xs text-slate-500">Phone: {row.phone}</p>}
                        </div>
                        <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">Pending</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => reviewClaim(row, true)}
                          className="card-press flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
                          <Check size={12} /> Approve + Verify Deal
                        </button>
                        <button onClick={() => reviewClaim(row, false)}
                          className="card-press flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
                          <X size={12} /> Reject
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Deals moderation ── */}
          {tab === 'deals' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20">
                <Search size={14} className="shrink-0 text-slate-500" />
                <input
                  value={dealSearch} onChange={(e) => setDealSearch(e.target.value)}
                  placeholder="Search deals by title or city…"
                  className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-500"
                  style={{ border: 'none', padding: 0, boxShadow: 'none', background: 'transparent' }}
                />
                {dealSearch && (
                  <button
                    onClick={() => setDealSearch('')}
                    aria-label="Clear search"
                    className="rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                  >
                    <X size={13} className="text-slate-500 hover:text-slate-300" />
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/8 bg-slate-900/60">
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Tag size={14} className="text-slate-400" /> Deal Moderation</h2>
                  <span className="text-xs text-slate-500">{filteredDeals.length} deals</span>
                </div>
                {filteredDeals.length === 0 ? (
                  <div className="py-12 text-center">
                    <Inbox size={28} className="mx-auto mb-3 text-slate-600" />
                    <p className="font-semibold text-slate-400">No deals found</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {dealSearch ? 'Try a different search term.' : 'No deals have been posted yet.'}
                    </p>
                    {dealSearch && (
                      <button
                        onClick={() => setDealSearch('')}
                        className="card-press mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {filteredDeals.map((deal, i) => {
                      const meta = getCategoryMeta(deal.category);
                      return (
                        <motion.div
                          key={deal.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(i, 10) * 0.04, ease: 'easeOut' }}
                          className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-white/3"
                        >
                          <span className="text-xl">{meta.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-semibold text-slate-200">{deal.title}</p>
                              {deal.is_verified && <span className="flex items-center gap-0.5 rounded-full border border-blue-500/30 bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-400"><Check size={9} /> Verified</span>}
                              {deal.is_boosted && <span className="flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400"><Zap size={9} /> Boosted</span>}
                              {deal.status === 'paused' && <span className="rounded-full border border-rose-500/30 bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-400">Paused</span>}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {getCategoryLabel(deal.category)} · {deal.city || 'No city'} ·
                              <span className="ml-1"><Eye size={9} className="inline" /> {deal.views}</span>
                              <span className="ml-1"><TrendingUp size={9} className="inline" /> {deal.clicks}</span>
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => moderateDeal(deal, deal.status === 'paused' ? 'resume' : 'pause')}
                              className={`card-press flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
                                ${deal.status === 'paused'
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'border-slate-500/30 bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'}`}>
                              {deal.status === 'paused' ? <><Play size={10} /> Resume</> : <><Pause size={10} /> Pause</>}
                            </button>
                            <button onClick={() => moderateDeal(deal, deal.is_verified ? 'unverify' : 'verify')}
                              className={`card-press flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
                                ${deal.is_verified
                                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                                  : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                              {deal.is_verified ? <><Check size={10} /> Verified</> : 'Verify'}
                            </button>
                            <button onClick={() => moderateDeal(deal, deal.is_boosted ? 'unfeature' : 'feature')}
                              className={`card-press flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
                                ${deal.is_boosted
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                  : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                              {deal.is_boosted ? <><Zap size={10} /> Featured</> : <><Zap size={10} /> Feature</>}
                            </button>
                            <button onClick={() => moderateDeal(deal, 'delete')}
                              aria-label={`Delete "${deal.title}"`}
                              className="card-press rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-400 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
                              <Trash2 size={10} className="inline" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Pricing ── */}
          {tab === 'pricing' && (
            <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-5">
              <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-white"><Zap size={16} className="text-amber-400" /> Boost Pricing Plans</h2>
              <p className="mb-5 text-xs text-slate-500">Set price (₹) and display label for each boost duration.</p>
              <div className="space-y-3">
                {boostPlans.map((plan, i) => (
                  <motion.div
                    key={plan.days}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.05, ease: 'easeOut' }}
                    className="grid items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-4 md:grid-cols-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15">
                        <Zap size={16} className="text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{plan.days} day boost</p>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₹</span>
                      <input
                        type="number" min={0} value={plan.price}
                        onChange={(e) => updateBoostPlan(plan.days, 'price', e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-800/80 py-2.5 pl-8 pr-3 text-sm text-white outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/20"
                        style={{ boxShadow: 'none' }}
                      />
                    </div>
                    <input
                      type="text" value={plan.label}
                      onChange={(e) => updateBoostPlan(plan.days, 'label', e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/20"
                      style={{ boxShadow: 'none' }}
                      placeholder="Display label (e.g. Starter Boost)"
                    />
                  </motion.div>
                ))}
              </div>
              <button onClick={saveBoostPlans} disabled={savingBoostPlans}
                className="card-press mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-neon-amber transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:opacity-60">
                {savingBoostPlans
                  ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Saving…</>
                  : <><Zap size={14} fill="currentColor" /> Save Pricing</>}
              </button>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* Footer stats */}
      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-white/5 pt-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Users size={11} /> {pendingPermissions.length + pendingClaims.length} pending</span>
        <span className="flex items-center gap-1"><Tag size={11} /> {stats.total} deals total</span>
        <span className="flex items-center gap-1"><Shield size={11} /> {stats.verified} verified</span>
        <span className="flex items-center gap-1"><Zap size={11} /> {stats.boosted} boosted</span>
      </div>
    </main>
  );
}
