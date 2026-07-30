'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { CATEGORY_OPTIONS } from '@/app/lib/categories';
import Link from 'next/link';
import {
  Mail, Lock, Store, UserPlus, User, Phone, MapPin,
  FileText, Globe, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft,
  Sparkles, Shield, Zap,
} from 'lucide-react';

const PHONE_RE = /^[6-9]\d{9}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const URL_RE   = /^https?:\/\/.+/;

const inputCls = 'w-full bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none';
const wrapCls  = 'mt-1.5 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-slate-800/80 px-3.5 py-3 transition focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20 hover:border-white/20';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-400';

function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-400">
      <AlertCircle size={11} /> {msg}
    </p>
  );
}

const STEPS = [
  { label: 'Account', icon: Shield },
  { label: 'Business', icon: Store },
  { label: 'Extras', icon: Sparkles },
];

export default function SignupPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const [businessName, setBusinessName]   = useState('');
  const [ownerName, setOwnerName]         = useState('');
  const [phone, setPhone]                 = useState('');
  const [city, setCity]                   = useState('');
  const [category, setCategory]           = useState('');
  const [description, setDescription]     = useState('');

  const [gstin, setGstin]         = useState('');
  const [website, setWebsite]     = useState('');
  const [instagram, setInstagram] = useState('');

  const [step, setStep]       = useState<1 | 2 | 3>(1);
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  function validate(currentStep: number): boolean {
    const e: Record<string, string> = {};
    if (currentStep === 1) {
      if (!email.trim())                    e.email    = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(email)) e.email   = 'Enter a valid email';
      if (!password)                        e.password = 'Password is required';
      else if (password.length < 6)        e.password = 'Minimum 6 characters';
    }
    if (currentStep === 2) {
      if (!businessName.trim())                  e.businessName = 'Business name is required';
      else if (businessName.trim().length < 3)   e.businessName = 'Minimum 3 characters';
      if (!ownerName.trim())                     e.ownerName = 'Owner name is required';
      else if (ownerName.trim().length < 2)      e.ownerName = 'Minimum 2 characters';
      if (!phone.trim())                         e.phone = 'Phone number is required';
      else if (!PHONE_RE.test(phone.trim()))     e.phone = 'Enter a valid 10-digit Indian mobile number';
      if (!city.trim())                          e.city = 'City is required';
      if (!category)                             e.category = 'Select a business category';
      if (!description.trim())                   e.description = 'Description is required';
      else if (description.trim().length < 50)   e.description = `Minimum 50 characters (${description.trim().length}/50)`;
    }
    if (currentStep === 3) {
      if (gstin.trim() && !GSTIN_RE.test(gstin.trim().toUpperCase()))
        e.gstin = 'Invalid GSTIN format (e.g. 29ABCDE1234F1Z5)';
      if (website.trim() && !URL_RE.test(website.trim()))
        e.website = 'Must start with https://';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const next = () => { if (validate(step)) setStep((s) => (s < 3 ? ((s + 1) as 1|2|3) : s)); };
  const back = () => setStep((s) => (s > 1 ? ((s - 1) as 1|2|3) : s));

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate(3)) return;
    setLoading(true); setApiError(null);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: {
        data: {
          role: 'business',
          business_profile: {
            shop_name: businessName.trim(), owner_name: ownerName.trim(),
            phone: phone.trim(), city: city.trim(), category, about: description.trim(),
            gstin: gstin.trim().toUpperCase() || null,
            website: website.trim() || null, instagram: instagram.trim() || null,
          },
        },
      },
    });

    setLoading(false);
    if (error) { setApiError(error.message); return; }
    if (data.user?.id) {
      await supabase.from('business_permissions').upsert({ user_id: data.user.id, status: 'approved', reason: null });
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/15 blur-[90px]" />
          <div className="absolute bottom-1/3 left-1/4 h-48 w-48 rounded-full bg-fuchsia-600/10 blur-[60px]" />
          <div className="absolute top-1/2 right-1/4 h-40 w-40 rounded-full bg-indigo-600/10 blur-[60px]" />
        </div>
        <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-600" />
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-white">You&apos;re all set!</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Check your email to verify your account. Business access is usually approved within 24 hours.
            </p>
            <Link
              href="/login"
              className="mt-6 flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-20 h-[600px] w-[600px] rounded-full bg-violet-700/20 blur-[140px] animate-aurora-1" />
        <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-indigo-700/20 blur-[140px] animate-aurora-2" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-700/10 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Top perks bar */}
        <div className="mb-5 flex items-center justify-center gap-6">
          {[
            { icon: Zap, text: 'Free listing' },
            { icon: Shield, text: 'Verified badge' },
            { icon: Sparkles, text: 'Instant reach' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Icon size={12} className="text-violet-400" /> {text}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-600" />

          {/* Header */}
          <div className="px-7 pb-6 pt-7 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-neon-violet">
              <Store size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">Business Signup</h1>
            <p className="mt-1 text-sm text-slate-500">Start listing your deals today</p>

            {/* Step progress */}
            <div className="relative mt-6 flex items-center justify-center">
              <div className="absolute top-[14px] left-1/2 h-px w-52 -translate-x-1/2 bg-white/10" />
              <div
                className="absolute top-[14px] left-1/2 h-px -translate-x-1/2 bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                style={{ width: step === 1 ? 0 : step === 2 ? '8rem' : '13rem' }}
              />
              <div className="relative flex items-center gap-16">
                {STEPS.map(({ label, icon: Icon }, i) => {
                  const n = i + 1;
                  const active = step === n;
                  const done = step > n;
                  return (
                    <div key={label} className="flex flex-col items-center gap-1.5">
                      <div className={`relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-2 transition-all duration-300
                        ${done   ? 'bg-emerald-500 ring-emerald-400/40 text-white scale-95'
                        : active ? 'scale-110 bg-gradient-to-br from-violet-500 to-fuchsia-600 ring-violet-400/40 text-white shadow-neon-violet'
                                 : 'bg-white/5 ring-white/10 text-slate-500'}`}>
                        {done ? <CheckCircle2 size={14} /> : <Icon size={12} />}
                      </div>
                      <span className={`text-[11px] font-semibold tracking-wide transition-colors duration-300
                        ${active ? 'text-white' : done ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="space-y-5 border-t border-white/8 p-7">

            {/* ── Step 1: Account ── */}
            {step === 1 && (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-violet-400">Step 1 — Credentials</div>
                <div>
                  <label className={labelCls}>Business Email <span className="text-violet-400">*</span></label>
                  <div className={wrapCls}>
                    <Mail size={15} className="shrink-0 text-slate-500" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className={inputCls} placeholder="business@email.com" autoComplete="email" />
                  </div>
                  <FieldError msg={errors.email ?? null} />
                </div>
                <div>
                  <label className={labelCls}>Password <span className="text-violet-400">*</span></label>
                  <div className={wrapCls}>
                    <Lock size={15} className="shrink-0 text-slate-500" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className={inputCls} placeholder="Minimum 6 characters" autoComplete="new-password" />
                  </div>
                  <FieldError msg={errors.password ?? null} />
                </div>
                <p className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-xs leading-relaxed text-violet-300">
                  <span className="font-semibold text-violet-200">You&apos;re creating a business account.</span> Your listing will go live after admin verification — usually within 24 hours.
                </p>
              </>
            )}

            {/* ── Step 2: Business Info ── */}
            {step === 2 && (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-violet-400">Step 2 — Business Details</div>
                <div>
                  <label className={labelCls}>Business Name <span className="text-violet-400">*</span></label>
                  <div className={wrapCls}>
                    <Store size={15} className="shrink-0 text-slate-500" />
                    <input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                      className={inputCls} placeholder="e.g. Sharma Electronics" />
                  </div>
                  <FieldError msg={errors.businessName ?? null} />
                </div>
                <div>
                  <label className={labelCls}>Owner / Contact Name <span className="text-violet-400">*</span></label>
                  <div className={wrapCls}>
                    <User size={15} className="shrink-0 text-slate-500" />
                    <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                      className={inputCls} placeholder="e.g. Ravi Sharma" />
                  </div>
                  <FieldError msg={errors.ownerName ?? null} />
                </div>
                <div>
                  <label className={labelCls}>Phone Number <span className="text-violet-400">*</span></label>
                  <div className={wrapCls}>
                    <Phone size={15} className="shrink-0 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-500">+91</span>
                    <div className="h-4 w-px bg-white/10" />
                    <input type="tel" maxLength={10} value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className={inputCls} placeholder="10-digit mobile number" />
                  </div>
                  <FieldError msg={errors.phone ?? null} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>City <span className="text-violet-400">*</span></label>
                    <div className={wrapCls}>
                      <MapPin size={15} className="shrink-0 text-slate-500" />
                      <input value={city} onChange={(e) => setCity(e.target.value)}
                        className={inputCls} placeholder="e.g. Bengaluru" />
                    </div>
                    <FieldError msg={errors.city ?? null} />
                  </div>
                  <div>
                    <label className={labelCls}>Category <span className="text-violet-400">*</span></label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)}
                      className="mt-1.5 w-full rounded-2xl border border-white/10 bg-slate-800/80 px-3.5 py-3 text-sm text-slate-200 outline-none transition focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20 hover:border-white/20">
                      <option value="" className="bg-slate-900">Select…</option>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                      ))}
                    </select>
                    <FieldError msg={errors.category ?? null} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    About your business <span className="text-violet-400">*</span>
                    <span className="ml-1.5 text-xs font-normal normal-case text-slate-500">({description.trim().length}/50 min)</span>
                  </label>
                  <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-slate-800/80 transition focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20 hover:border-white/20">
                    <div className="flex items-start gap-2.5 px-3.5 pt-3">
                      <FileText size={15} className="mt-0.5 shrink-0 text-slate-500" />
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                        rows={3} className="w-full resize-none bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
                        placeholder="Tell customers what you offer, your specialty, timings, etc." />
                    </div>
                    <div className="flex items-center justify-between px-3.5 pb-2.5 pt-1">
                      <span className="text-[11px] text-slate-500">Describe your offerings in detail</span>
                      <span className={`text-[11px] font-medium ${description.trim().length >= 50 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {description.length} chars
                      </span>
                    </div>
                  </div>
                  <FieldError msg={errors.description ?? null} />
                </div>
              </>
            )}

            {/* ── Step 3: Optional Extras ── */}
            {step === 3 && (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-violet-400">Step 3 — Optional Extras</div>
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
                  All fields on this step are optional — you can add these later from your dashboard.
                </p>
                <div>
                  <label className={labelCls}>GSTIN</label>
                  <div className={wrapCls}>
                    <Shield size={15} className="shrink-0 text-slate-500" />
                    <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      maxLength={15} className={`${inputCls} font-mono tracking-wider`} placeholder="29ABCDE1234F1Z5" />
                  </div>
                  <FieldError msg={errors.gstin ?? null} />
                </div>
                <div>
                  <label className={labelCls}>Website</label>
                  <div className={wrapCls}>
                    <Globe size={15} className="shrink-0 text-slate-500" />
                    <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)}
                      className={inputCls} placeholder="https://yourbusiness.com" />
                  </div>
                  <FieldError msg={errors.website ?? null} />
                </div>
                <div>
                  <label className={labelCls}>Instagram Handle</label>
                  <div className={wrapCls}>
                    <span className="text-sm font-bold text-slate-500">@</span>
                    <input value={instagram} onChange={(e) => setInstagram(e.target.value.replace('@', ''))}
                      className={inputCls} placeholder="yourbusiness" />
                  </div>
                </div>
                {apiError && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-400">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    {apiError}
                  </div>
                )}
              </>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-1">
              {step > 1 && (
                <button type="button" onClick={back}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 active:scale-95">
                  <ChevronLeft size={15} /> Back
                </button>
              )}
              {step < 3 ? (
                <button type="button" onClick={next}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90 hover:shadow-[0_0_32px_rgba(139,92,246,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 active:scale-[0.98]">
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button type="submit" disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-neon-violet transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 active:scale-[0.98]">
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Creating account…
                    </>
                  ) : (
                    <><UserPlus size={16} /> Create Account</>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="border-t border-white/8 px-7 py-5 text-center text-sm">
            <p className="text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="rounded font-semibold text-violet-400 transition hover:text-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Trust indicators */}
        <p className="mt-4 text-center text-xs text-slate-500">
          Secured with Supabase Auth · Business accounts verified within 24h
        </p>
      </div>
    </main>
  );
}
