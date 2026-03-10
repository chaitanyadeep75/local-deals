'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { Check, X, Shield, Flag, Store } from 'lucide-react';
import { BOOST_PLANS_CONFIG_KEY, getDefaultBoostPlans, parseBoostPlans, type BoostPlan } from '@/app/lib/monetization';

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
  user_id: string;
  updated_at: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingPermissions, setPendingPermissions] = useState<PermissionRow[]>([]);
  const [pendingClaims, setPendingClaims] = useState<ClaimRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [boostPlans, setBoostPlans] = useState<BoostPlan[]>(getDefaultBoostPlans());
  const [savingBoostPlans, setSavingBoostPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingTotal = useMemo(() => pendingPermissions.length + pendingClaims.length, [pendingPermissions.length, pendingClaims.length]);

  const loadData = async () => {
    setError(null);
    const [{ data: permRows }, { data: claimRows }, { data: dealRows }, { data: boostConfig }] = await Promise.all([
      supabase.from('business_permissions').select('user_id, status, reason, created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(100),
      supabase.from('business_claims').select('id, deal_id, claimant_user_id, business_name, phone, status, created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(100),
      supabase.from('deals').select('id, title, status, is_verified, user_id, updated_at').order('updated_at', { ascending: false }).limit(50),
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
      if (!user) {
        router.replace('/login');
        return;
      }

      const role = user.user_metadata?.role;
      if (role === 'admin') {
        setIsAdmin(true);
      } else {
        const adminCheck = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        setIsAdmin(!!adminCheck.data);
      }
      setReady(true);
    };
    void boot();
  }, [router]);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          user_id: row.claimant_user_id,
          status: 'approved',
          reviewed_by: auth.user?.id || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      ]);
    }
    void loadData();
  };

  const moderateDeal = async (deal: DealRow, action: 'pause' | 'resume' | 'verify' | 'unverify') => {
    const { data: auth } = await supabase.auth.getUser();
    if (action === 'pause' || action === 'resume') {
      await supabase.from('deals').update({ status: action === 'pause' ? 'paused' : 'active' }).eq('id', deal.id);
    }
    if (action === 'verify' || action === 'unverify') {
      await supabase.from('deals').update({ is_verified: action === 'verify' }).eq('id', deal.id);
    }
    await supabase.from('deal_moderation_actions').insert({
      deal_id: deal.id,
      moderator_user_id: auth.user?.id || '00000000-0000-0000-0000-000000000000',
      action,
      reason: null,
    });
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
    setSavingBoostPlans(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    const plansToSave = parseBoostPlans(boostPlans);
    const { error: saveError } = await supabase.from('admin_config').upsert({
      key: BOOST_PLANS_CONFIG_KEY,
      value: plansToSave,
      updated_by: auth.user?.id || null,
      updated_at: new Date().toISOString(),
    });
    if (saveError) {
      if (saveError.message.includes("public.admin_config")) {
        setError('Admin config table is missing. Run the admin_config SQL migration in Supabase SQL Editor, then retry.');
      } else {
        setError(saveError.message);
      }
      setSavingBoostPlans(false);
      return;
    }
    setBoostPlans(plansToSave);
    setSavingBoostPlans(false);
  };

  if (!ready) {
    return <main className="min-h-screen grid place-items-center text-sm text-slate-500">Loading admin...</main>;
  }

  if (!isAdmin) {
    return <main className="min-h-screen grid place-items-center text-sm text-rose-600">Access denied. Admin only.</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="inline-flex items-center gap-2 text-xl font-bold text-slate-900"><Shield size={18} /> Admin Console</h1>
          <p className="mt-1 text-sm text-slate-500">{pendingTotal} pending approval items</p>
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><Store size={15} /> Pending Business Approvals</h2>
          <div className="space-y-2">
            {pendingPermissions.length ? pendingPermissions.map((row) => (
              <div key={row.user_id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{row.user_id}</p>
                  <p className="text-xs text-slate-500">Requested {new Date(row.created_at).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reviewPermission(row, true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"><Check size={12} /> Approve</button>
                  <button onClick={() => reviewPermission(row, false)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white"><X size={12} /> Reject</button>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">No pending business approvals.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><Flag size={15} /> Pending Business Claims</h2>
          <div className="space-y-2">
            {pendingClaims.length ? pendingClaims.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{row.business_name || 'Business claim'} · Deal #{row.deal_id}</p>
                  <p className="text-xs text-slate-500">Claimant: {row.claimant_user_id}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reviewClaim(row, true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"><Check size={12} /> Approve</button>
                  <button onClick={() => reviewClaim(row, false)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white"><X size={12} /> Reject</button>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">No pending claims.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Monetization Settings</h2>
          <div className="space-y-3">
            {boostPlans.map((plan) => (
              <div key={plan.days} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-3">
                <p className="text-sm font-medium text-slate-700">{plan.days} day plan</p>
                <input
                  type="number"
                  min={0}
                  value={plan.price}
                  onChange={(e) => updateBoostPlan(plan.days, 'price', e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-indigo-300"
                />
                <input
                  type="text"
                  value={plan.label}
                  onChange={(e) => updateBoostPlan(plan.days, 'label', e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-indigo-300"
                />
              </div>
            ))}
            <button
              onClick={saveBoostPlans}
              disabled={savingBoostPlans}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {savingBoostPlans ? 'Saving...' : 'Save Boost Pricing'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Deal Moderation</h2>
          <div className="space-y-2">
            {deals.map((deal) => (
              <div key={deal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{deal.title}</p>
                  <p className="text-xs text-slate-500">Status: {deal.status || 'active'} · Verified: {deal.is_verified ? 'yes' : 'no'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => moderateDeal(deal, deal.status === 'paused' ? 'resume' : 'pause')} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700">{deal.status === 'paused' ? 'Resume' : 'Pause'}</button>
                  <button onClick={() => moderateDeal(deal, deal.is_verified ? 'unverify' : 'verify')} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700">{deal.is_verified ? 'Unverify' : 'Verify'}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
