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

const inputCls = 'w-full bg-white text-gray-900 placeholder:text-gray-400 outline-none text-sm';
const wrapCls  = 'mt-1.5 flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3.5 py-3 transition-all duration-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20 hover:border-gray-300';
const labelCls = 'block text-sm font-semibold text-gray-700';

function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-500">
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
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-0 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full bg-purple-600/20 blur-[120px]" />
        </div>
        <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-10 shadow-2xl text-center ring-1 ring-black/5">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-200">
            <CheckCircle2 size={30} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">You&apos;re all set!</h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            Check your email to verify your account. Business access is usually approved within 24 hours.
          </p>
          <Link href="/login" className="mt-6 block rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:opacity-90 transition">
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-4 py-12">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-20 h-[600px] w-[600px] rounded-full bg-indigo-700/25 blur-[140px] animate-aurora-1" />
        <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-purple-700/25 blur-[140px] animate-aurora-2" />
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
            <div key={text} className="flex items-center gap-1.5 text-xs font-medium text-white/50">
              <Icon size={12} className="text-indigo-400" /> {text}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10">

          {/* Header gradient */}
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-8 pt-8 pb-7">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            <div className="relative">
              <div className="mx-auto mb-3 flex h-13 w-13 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm" style={{ width: 52, height: 52 }}>
                <Store size={24} className="text-white" />
              </div>
              <h1 className="text-center text-2xl font-extrabold tracking-tight text-white">Business Signup</h1>
              <p className="mt-1 text-center text-sm text-indigo-200">Start listing your deals today</p>
            </div>

            {/* Step progress */}
            <div className="relative mt-6 flex items-center justify-center">
              <div className="absolute top-[14px] left-1/2 h-px w-52 -translate-x-1/2 bg-white/20" />
              <div
                className="absolute top-[14px] left-1/2 h-px -translate-x-1/2 bg-white/70 transition-all duration-500"
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
                        ${done   ? 'bg-emerald-400 ring-emerald-300 text-white scale-95'
                        : active ? 'bg-white ring-white/60 text-indigo-700 scale-110 shadow-lg shadow-white/20'
                                 : 'bg-white/15 ring-white/20 text-white/60'}`}>
                        {done ? <CheckCircle2 size={14} /> : <Icon size={12} />}
                      </div>
                      <span className={`text-[11px] font-semibold tracking-wide transition-colors duration-300
                        ${active ? 'text-white' : done ? 'text-emerald-300' : 'text-indigo-300'}`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Form body */}
          <form onSubmit={handleSubmit} className="space-y-5 p-8">

            {/* ── Step 1: Account ── */}
            {step === 1 && (
              <>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-indigo-500">Step 1 — Credentials</div>
                <div>
                  <label className={labelCls}>Business Email <span className="text-indigo-500">*</span></label>
                  <div className={wrapCls}>
                    <Mail size={16} className="shrink-0 text-indigo-400" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className={inputCls} placeholder="business@email.com" autoComplete="email" />
                  </div>
                  <FieldError msg={errors.email ?? null} />
                </div>
                <div>
                  <label className={labelCls}>Password <span className="text-indigo-500">*</span></label>
                  <div className={wrapCls}>
                    <Lock size={16} className="shrink-0 text-indigo-400" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className={inputCls} placeholder="Minimum 6 characters" autoComplete="new-password" />
                  </div>
                  <FieldError msg={errors.password ?? null} />
                </div>
                <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-700 leading-relaxed">
                  <span className="font-semibold">You&apos;re creating a business account.</span> Your listing will go live after admin verification — usually within 24 hours.
                </p>
              </>
            )}

            {/* ── Step 2: Business Info ── */}
            {step === 2 && (
              <>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-indigo-500">Step 2 — Business Details</div>
                <div>
                  <label className={labelCls}>Business Name <span className="text-indigo-500">*</span></label>
                  <div className={wrapCls}>
                    <Store size={16} className="shrink-0 text-indigo-400" />
                    <input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                      className={inputCls} placeholder="e.g. Sharma Electronics" />
                  </div>
                  <FieldError msg={errors.businessName ?? null} />
                </div>
                <div>
                  <label className={labelCls}>Owner / Contact Name <span className="text-indigo-500">*</span></label>
                  <div className={wrapCls}>
                    <User size={16} className="shrink-0 text-indigo-400" />
                    <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                      className={inputCls} placeholder="e.g. Ravi Sharma" />
                  </div>
                  <FieldError msg={errors.ownerName ?? null} />
                </div>
                <div>
                  <label className={labelCls}>Phone Number <span className="text-indigo-500">*</span></label>
                  <div className={wrapCls}>
                    <Phone size={16} className="shrink-0 text-indigo-400" />
                    <span className="text-sm font-semibold text-gray-400">+91</span>
                    <div className="h-4 w-px bg-gray-200" />
                    <input type="tel" maxLength={10} value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className={inputCls} placeholder="10-digit mobile number" />
                  </div>
                  <FieldError msg={errors.phone ?? null} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>City <span className="text-indigo-500">*</span></label>
                    <div className={wrapCls}>
                      <MapPin size={16} className="shrink-0 text-indigo-400" />
                      <input value={city} onChange={(e) => setCity(e.target.value)}
                        className={inputCls} placeholder="e.g. Bengaluru" />
                    </div>
                    <FieldError msg={errors.city ?? null} />
                  </div>
                  <div>
                    <label className={labelCls}>Category <span className="text-indigo-500">*</span></label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition-all duration-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300">
                      <option value="">Select…</option>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <FieldError msg={errors.category ?? null} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>
                    About your business <span className="text-indigo-500">*</span>
                    <span className="ml-1.5 text-xs font-normal text-gray-400">({description.trim().length}/50 min)</span>
                  </label>
                  <div className="mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20 hover:border-gray-300">
                    <div className="flex items-start gap-2.5 px-3.5 pt-3">
                      <FileText size={16} className="mt-0.5 shrink-0 text-indigo-400" />
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                        rows={3} className="w-full resize-none bg-white text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                        placeholder="Tell customers what you offer, your specialty, timings, etc." />
                    </div>
                    <div className="flex items-center justify-between px-3.5 pb-2.5 pt-1">
                      <span className="text-[11px] text-gray-400">Describe your offerings in detail</span>
                      <span className={`text-[11px] font-medium ${description.trim().length >= 50 ? 'text-emerald-500' : 'text-gray-400'}`}>
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
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-indigo-500">Step 3 — Optional Extras</div>
                <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  All fields on this step are optional — you can add these later from your dashboard.
                </p>
                <div>
                  <label className={labelCls}>GSTIN</label>
                  <div className={wrapCls}>
                    <Shield size={16} className="shrink-0 text-indigo-400" />
                    <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      maxLength={15} className={`${inputCls} font-mono tracking-wider`} placeholder="29ABCDE1234F1Z5" />
                  </div>
                  <FieldError msg={errors.gstin ?? null} />
                </div>
                <div>
                  <label className={labelCls}>Website</label>
                  <div className={wrapCls}>
                    <Globe size={16} className="shrink-0 text-indigo-400" />
                    <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)}
                      className={inputCls} placeholder="https://yourbusiness.com" />
                  </div>
                  <FieldError msg={errors.website ?? null} />
                </div>
                <div>
                  <label className={labelCls}>Instagram Handle</label>
                  <div className={wrapCls}>
                    <span className="text-sm font-bold text-indigo-400">@</span>
                    <input value={instagram} onChange={(e) => setInstagram(e.target.value.replace('@', ''))}
                      className={inputCls} placeholder="yourbusiness" />
                  </div>
                </div>
                {apiError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-sm text-red-600">{apiError}</p>
                  </div>
                )}
              </>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-1">
              {step > 1 && (
                <button type="button" onClick={back}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 hover:border-gray-300 active:scale-95">
                  <ChevronLeft size={15} /> Back
                </button>
              )}
              {step < 3 ? (
                <button type="button" onClick={next}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90 hover:shadow-indigo-500/40 active:scale-[0.98]">
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button type="submit" disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]">
                  {loading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
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
          <div className="border-t border-gray-100 px-8 py-5 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Trust indicators */}
        <p className="mt-5 text-center text-xs text-white/30">
          Secured with Supabase Auth · Business accounts verified within 24h
        </p>
      </div>
    </main>
  );
}
