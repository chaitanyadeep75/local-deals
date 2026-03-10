'use client';

import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { CATEGORY_OPTIONS } from '@/app/lib/categories';
import Link from 'next/link';
import {
  Mail, Lock, Store, UserPlus, User, Phone, MapPin,
  FileText, Globe, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft,
} from 'lucide-react';

const PHONE_RE = /^[6-9]\d{9}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const URL_RE   = /^https?:\/\/.+/;

function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
      <AlertCircle size={11} /> {msg}
    </p>
  );
}

export default function SignupPage() {
  // Step 1 — credentials
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Step 2 — business info
  const [businessName, setBusinessName]   = useState('');
  const [ownerName, setOwnerName]         = useState('');
  const [phone, setPhone]                 = useState('');
  const [city, setCity]                   = useState('');
  const [category, setCategory]           = useState('');
  const [description, setDescription]     = useState('');

  // Step 3 — optional extras
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
      if (!email.trim())               e.email    = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
      if (!password)                   e.password = 'Password is required';
      else if (password.length < 6)   e.password = 'Minimum 6 characters';
    }

    if (currentStep === 2) {
      if (!businessName.trim())               e.businessName = 'Business name is required';
      else if (businessName.trim().length < 3) e.businessName = 'Minimum 3 characters';

      if (!ownerName.trim())                  e.ownerName = 'Owner name is required';
      else if (ownerName.trim().length < 2)   e.ownerName = 'Minimum 2 characters';

      if (!phone.trim())                      e.phone = 'Phone number is required';
      else if (!PHONE_RE.test(phone.trim()))  e.phone = 'Enter a valid 10-digit Indian mobile number';

      if (!city.trim())                       e.city = 'City is required';
      if (!category)                          e.category = 'Select a business category';

      if (!description.trim())                e.description = 'Description is required';
      else if (description.trim().length < 50) e.description = `Minimum 50 characters (${description.trim().length}/50)`;
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

  const next = () => {
    if (validate(step)) setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  };

  const back = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate(3)) return;
    setLoading(true);
    setApiError(null);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          role: 'business',
          business_profile: {
            shop_name:   businessName.trim(),
            owner_name:  ownerName.trim(),
            phone:       phone.trim(),
            city:        city.trim(),
            category,
            about:       description.trim(),
            gstin:       gstin.trim().toUpperCase() || null,
            website:     website.trim() || null,
            instagram:   instagram.trim() || null,
          },
        },
      },
    });

    setLoading(false);

    if (error) {
      setApiError(error.message);
      return;
    }

    if (data.user?.id) {
      await supabase.from('business_permissions').upsert({
        user_id: data.user.id,
        status: 'approved',
        reason: null,
      });
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl text-center">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500" />
          <h2 className="text-xl font-bold text-slate-900">You're registered!</h2>
          <p className="mt-2 text-sm text-gray-500">
            Please verify your email. Business posting access will be enabled after admin approval — usually within 24 hours.
          </p>
          <Link href="/login" className="mt-6 block rounded-xl bg-black py-3 text-sm font-semibold text-white">
            Go to Login
          </Link>
        </div>
      </main>
    );
  }

  const stepLabels = ['Account', 'Business', 'Extras'];

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">

        {/* Header */}
        <div className="rounded-t-3xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 pt-8 pb-6 text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
            <Store size={22} />
          </div>
          <h1 className="text-center text-2xl font-extrabold">Business Signup</h1>
          <p className="mt-1 text-center text-sm text-indigo-100">Start listing your deals today</p>

          {/* Step progress */}
          <div className="mt-5 flex items-center justify-center gap-2">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              const active = step === n;
              const done   = step > n;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all
                    ${done   ? 'bg-emerald-400 text-white'
                    : active ? 'bg-white text-indigo-700'
                             : 'bg-white/25 text-white'}`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`text-xs font-medium ${active ? 'text-white' : 'text-indigo-200'}`}>{label}</span>
                  {i < 2 && <span className="text-indigo-300">›</span>}
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-8">

          {/* ── Step 1: Account ── */}
          {step === 1 && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700">Business Email *</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-500">
                  <Mail size={18} className="shrink-0 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full outline-none text-sm"
                    placeholder="business@email.com"
                  />
                </div>
                <FieldError msg={errors.email ?? null} />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Password *</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-500">
                  <Lock size={18} className="shrink-0 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full outline-none text-sm"
                    placeholder="Minimum 6 characters"
                  />
                </div>
                <FieldError msg={errors.password ?? null} />
              </div>
            </>
          )}

          {/* ── Step 2: Business Info ── */}
          {step === 2 && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700">Business Name *</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-500">
                  <Store size={18} className="shrink-0 text-gray-400" />
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full outline-none text-sm"
                    placeholder="e.g. Sharma Electronics"
                  />
                </div>
                <FieldError msg={errors.businessName ?? null} />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Owner / Contact Name *</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-500">
                  <User size={18} className="shrink-0 text-gray-400" />
                  <input
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full outline-none text-sm"
                    placeholder="e.g. Ravi Sharma"
                  />
                </div>
                <FieldError msg={errors.ownerName ?? null} />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Phone Number *</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-500">
                  <Phone size={18} className="shrink-0 text-gray-400" />
                  <span className="text-sm text-gray-400">+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full outline-none text-sm"
                    placeholder="10-digit mobile number"
                  />
                </div>
                <FieldError msg={errors.phone ?? null} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">City *</label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-500">
                    <MapPin size={18} className="shrink-0 text-gray-400" />
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full outline-none text-sm"
                      placeholder="e.g. Bengaluru"
                    />
                  </div>
                  <FieldError msg={errors.city ?? null} />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select…</option>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <FieldError msg={errors.category ?? null} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  About your business *
                  <span className="ml-1 font-normal text-gray-400">({description.trim().length}/50 min)</span>
                </label>
                <div className="mt-1 rounded-xl border focus-within:ring-2 focus-within:ring-indigo-500">
                  <div className="flex items-start gap-2 px-3 pt-3">
                    <FileText size={18} className="mt-0.5 shrink-0 text-gray-400" />
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full outline-none text-sm resize-none"
                      placeholder="Tell customers what you offer, your specialty, timings, etc."
                    />
                  </div>
                  <p className="px-3 pb-2 text-right text-[11px] text-gray-400">{description.length} chars</p>
                </div>
                <FieldError msg={errors.description ?? null} />
              </div>
            </>
          )}

          {/* ── Step 3: Optional Extras ── */}
          {step === 3 && (
            <>
              <p className="text-xs text-slate-500">All fields on this step are optional.</p>

              <div>
                <label className="text-sm font-medium text-gray-700">GSTIN</label>
                <input
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  maxLength={15}
                  className="mt-1 w-full rounded-xl border px-3 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="29ABCDE1234F1Z5"
                />
                <FieldError msg={errors.gstin ?? null} />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Website</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-500">
                  <Globe size={18} className="shrink-0 text-gray-400" />
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full outline-none text-sm"
                    placeholder="https://yourbusiness.com"
                  />
                </div>
                <FieldError msg={errors.website ?? null} />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Instagram Handle</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border px-3 py-3 focus-within:ring-2 focus-within:ring-indigo-500">
                  <span className="text-sm font-semibold text-gray-400">@</span>
                  <input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value.replace('@', ''))}
                    className="w-full outline-none text-sm"
                    placeholder="yourbusiness"
                  />
                </div>
              </div>

              {apiError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {apiError}
                </p>
              )}
            </>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <button
                type="button"
                onClick={back}
                className="flex items-center gap-1 rounded-xl border px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-bold text-white hover:opacity-90 transition"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-bold text-white hover:opacity-90 transition disabled:opacity-60"
              >
                <UserPlus size={18} />
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            )}
          </div>
        </form>

        <p className="pb-8 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-indigo-600">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
