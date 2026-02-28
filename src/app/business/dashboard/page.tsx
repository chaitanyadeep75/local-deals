'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { CATEGORY_OPTIONS, getCategoryLabel } from '@/app/lib/categories';
import { useRouter } from 'next/navigation';
import { computeDealHealth } from '@/app/lib/deal-utils';
import {
  Plus, Trash2, Pencil, Eye, MousePointerClick,
  MapPin, LocateFixed, AlertCircle, Info, MapPinOff,
  Store, Phone, Globe, Instagram, BadgePercent, Ticket, FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Deal = {
  id: number;
  title: string;
  description: string;
  valid_till_date: string | null;
  views: number;
  clicks: number;
  category: string | null;
  image: string | null;
  image_urls?: string[] | null;
  latitude: number | null;
  longitude: number | null;
  area: string | null;
  city: string | null;
  offer_price?: string | null;
  original_price?: string | null;
  discount_label?: string | null;
  coupon_code?: string | null;
  terms?: string | null;
  redemption_mode?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  status?: string | null;
  is_verified?: boolean | null;
  updated_at?: string | null;
};

type LocationValue = {
  lat: number | null;
  lng: number | null;
  label: string;
  area: string;
  city: string;
};

type MapboxContextItem = {
  id?: string;
  text?: string;
};

type MapboxFeature = {
  id?: string;
  center?: [number, number];
  text?: string;
  place_name?: string;
  context?: MapboxContextItem[];
};

/* ─────────────────────────────────────────
   PARSE MAPBOX FEATURE → area + city
   Handles Indian address context correctly
───────────────────────────────────────── */
function parseMapboxFeature(feature: MapboxFeature): { area: string; city: string } {
  const context = feature.context || [];

  // Mapbox context types for India (in order of preference):
  // locality → neighbourhood/area (e.g. "Koramangala")
  // place    → city (e.g. "Bengaluru")
  // district → district (e.g. "Bangalore Urban")
  // region   → state (e.g. "Karnataka")

  const locality = context.find((c) =>
    c.id?.startsWith('locality') || c.id?.startsWith('neighborhood')
  )?.text || '';

  const place = context.find((c) =>
    c.id?.startsWith('place')
  )?.text || '';

  const district = context.find((c) =>
    c.id?.startsWith('district')
  )?.text || '';

  // For POIs/addresses, feature.text is the place name itself
  // Use locality as area, place as city; fall back to district if no place
  const area = locality || feature.text || '';
  const city = place || district || '';

  return { area, city };
}

/* ─────────────────────────────────────────
   GEO HELPERS
───────────────────────────────────────── */
async function reverseGeocode(lat: number, lng: number): Promise<{ label: string; area: string; city: string }> {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=address,poi,neighborhood,locality,place&limit=1`
    );
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, area: '', city: '' };
    const { area, city } = parseMapboxFeature(feature);
    return { label: feature.place_name, area, city };
  } catch {
    return { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, area: '', city: '' };
  }
}

async function forwardGeocode(query: string): Promise<LocationValue | null> {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return null;
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&types=address,poi,neighborhood,locality,place&limit=1&country=in`
    );
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature?.center) return null;
    const [lng, lat] = feature.center;
    const { area, city } = parseMapboxFeature(feature);
    return { lat, lng, label: feature.place_name || query, area, city };
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────
   LOCATION PICKER
───────────────────────────────────────── */
function LocationPicker({
  value,
  onChange,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
}) {
  const [query, setQuery] = useState(value.label || '');
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'error' | 'denied' | 'ip-fallback'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value.label || '');
  }, [value.label]);

  const search = async (q: string) => {
    if (!q || q.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&types=poi,address,locality,place,neighborhood&limit=6&country=in`
      );
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch { setSuggestions([]); }
    finally { setLoading(false); }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setGeoStatus('idle');
    // If the user edits text manually, clear pinned coordinates until they re-select.
    onChange({ lat: null, lng: null, label: v, area: '', city: '' });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 350);
  };

  const selectSuggestion = (feature: MapboxFeature) => {
    if (!feature.center) return;
    const [lng, lat] = feature.center;
    const { area, city } = parseMapboxFeature(feature);
    onChange({ lat, lng, label: feature.place_name || '', area, city });
    setQuery(feature.place_name || '');
    setSuggestions([]);
    setGeoStatus('idle');
  };

  const useCurrentLocation = () => {
    setGeoLoading(true);
    setGeoStatus('idle');
    if (!navigator.geolocation) { setGeoStatus('error'); setGeoLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const geo = await reverseGeocode(lat, lng);
        onChange({ lat, lng, ...geo });
        setQuery(geo.label);
        setGeoLoading(false);
        setSuggestions([]);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus('denied');
        } else {
          setGeoStatus('error');
        }
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex items-center gap-2 w-full p-4 border rounded-xl focus-within:ring-2 focus-within:ring-purple-500 bg-white">
          <MapPin size={18} className="text-purple-500 shrink-0" />
          <input
            className="w-full outline-none text-sm"
            style={{ border: 'none', padding: 0, borderRadius: 0, boxShadow: 'none' }}
            placeholder="Search area, street, landmark…"
            value={query}
            onChange={handleInput}
          />
          {loading && <span className="text-xs text-gray-400 shrink-0 animate-pulse">Searching…</span>}
        </div>

        {suggestions.length > 0 && (
          <ul className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            {suggestions.map((s) => {
              const { area, city } = parseMapboxFeature(s);
              const subtitle = [area, city].filter(Boolean).join(', ') || s.place_name;
              return (
                <li key={s.id} onClick={() => selectSuggestion(s)}
                  className="px-4 py-3 text-sm hover:bg-purple-50 cursor-pointer border-b last:border-0 flex items-start gap-2">
                  <MapPin size={13} className="text-purple-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium block truncate">{s.text}</span>
                    <span className="text-gray-400 text-xs truncate block">{subtitle}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button type="button" onClick={useCurrentLocation} disabled={geoLoading}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all w-full justify-center
          ${geoLoading ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-wait'
            : 'bg-white border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 active:scale-95'}`}>
        <LocateFixed size={16} className={geoLoading ? 'animate-spin text-purple-400' : 'text-purple-500'} />
        {geoLoading ? 'Detecting location…' : '📡 Use my current location'}
      </button>

      <AnimatePresence>
        {geoStatus === 'ip-fallback' && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Info size={13} className="mt-0.5 shrink-0" />
            Using approximate IP location. Please search for your exact address above.
          </motion.div>
        )}
        {geoStatus === 'denied' && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
            <p className="flex items-center gap-1.5 text-red-700 font-medium"><AlertCircle size={13} /> Permission denied</p>
            <p className="text-red-600"><strong>Mac:</strong> System Settings → Privacy & Security → Location Services → enable Chrome.</p>
          </motion.div>
        )}
        {geoStatus === 'error' && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            Could not detect location. Please search for your address above.
          </motion.div>
        )}
      </AnimatePresence>

      {value.lat && geoStatus !== 'denied' && (
        <div className="flex items-center gap-2 ml-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block shrink-0" />
          <p className="text-xs text-green-700 font-medium">
            {value.area && value.city
              ? `📍 ${value.area}, ${value.city}`
              : value.area || value.city
                ? `📍 ${value.area || value.city}`
                : `Pinned: ${value.lat.toFixed(4)}, ${value.lng?.toFixed(4)}`
            }
            {geoStatus === 'ip-fallback' && <span className="text-amber-500 ml-1">(approx.)</span>}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   EDIT LOCATION MODAL
───────────────────────────────────────── */
function EditLocationModal({ deal, onSave, onClose }: { deal: Deal; onSave: () => void; onClose: () => void }) {
  const [location, setLocation] = useState<LocationValue>({
    lat: deal.latitude, lng: deal.longitude,
    label: [deal.area, deal.city].filter(Boolean).join(', ') || '',
    area: deal.area || '', city: deal.city || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (location.lat === null || location.lng === null) return;
    setSaving(true);
    await supabase.from('deals').update({
      latitude: location.lat,
      longitude: location.lng,
      area: location.area || null,
      city: location.city || null,
    }).eq('id', deal.id);
    setSaving(false);
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={18} className="text-purple-600" />
          <h2 className="text-lg font-semibold">Set Location</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          For: <span className="font-medium text-gray-800">{deal.title}</span>
        </p>
        <LocationPicker value={location} onChange={setLocation} />
        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} disabled={saving || !location.lat}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 hover:opacity-90 transition">
            {saving ? 'Saving…' : '✓ Save Location'}
          </button>
          <button onClick={onClose} className="flex-1 border py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition">
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const extractMissingDealsColumn = (error: unknown) => {
  const msg = String((error as { message?: string } | null)?.message || '').toLowerCase();
  const fromCache = msg.match(/'([a-z0-9_]+)' column of 'deals'/i);
  if (fromCache?.[1]) return fromCache[1];
  const fromPg = msg.match(/column "?([a-z0-9_]+)"? does not exist/i);
  if (fromPg?.[1]) return fromPg[1];
  return (error as { code?: string } | null)?.code === '42703' ? 'unknown' : null;
};

const uploadDealImages = async (files: File[]) => {
  if (!files.length) return [] as string[];
  const uploads = await Promise.all(
    files.map(async (file) => {
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
      const { error } = await supabase.storage.from('deal-images').upload(fileName, file);
      if (error) return null;
      const { data } = supabase.storage.from('deal-images').getPublicUrl(fileName);
      return data.publicUrl;
    })
  );
  return uploads.filter((u): u is string => !!u);
};

const insertDealWithFallback = async (payload: Record<string, unknown>) => {
  let current = { ...payload };
  for (let i = 0; i < 12; i += 1) {
    const result = await supabase
      .from('deals')
      .insert(current)
      .select('id, latitude, longitude')
      .single();
    if (!result.error) return result;
    const missingColumn = extractMissingDealsColumn(result.error);
    if (!missingColumn || missingColumn === 'unknown' || !(missingColumn in current)) return result;
    const next = { ...current };
    delete next[missingColumn];
    current = next;
  }
  return supabase.from('deals').insert(current).select('id, latitude, longitude').single();
};

const insertDealWithoutSelectWithFallback = async (payload: Record<string, unknown>) => {
  let current = { ...payload };
  for (let i = 0; i < 12; i += 1) {
    const result = await supabase.from('deals').insert(current);
    if (!result.error) return result;
    const missingColumn = extractMissingDealsColumn(result.error);
    if (!missingColumn || missingColumn === 'unknown' || !(missingColumn in current)) return result;
    const next = { ...current };
    delete next[missingColumn];
    current = next;
  }
  return supabase.from('deals').insert(current);
};

const updateDealWithFallback = async (id: number, payload: Record<string, unknown>) => {
  let current = { ...payload };
  for (let i = 0; i < 12; i += 1) {
    const result = await supabase.from('deals').update(current).eq('id', id);
    if (!result.error) return result;
    const missingColumn = extractMissingDealsColumn(result.error);
    if (!missingColumn || missingColumn === 'unknown' || !(missingColumn in current)) return result;
    const next = { ...current };
    delete next[missingColumn];
    current = next;
  }
  return supabase.from('deals').update(current).eq('id', id);
};

/* ─────────────────────────────────────────
   DASHBOARD PAGE
───────────────────────────────────────── */
export default function BusinessDashboard() {
  const router = useRouter();
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopWhatsapp, setShopWhatsapp] = useState('');
  const [shopWebsite, setShopWebsite] = useState('');
  const [shopInstagram, setShopInstagram] = useState('');
  const [shopAbout, setShopAbout] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [redemption, setRedemption] = useState('in-store');
  const [terms, setTerms] = useState('');
  const [validTillDate, setValidTillDate] = useState('');
  const [category, setCategory] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [location, setLocation] = useState<LocationValue>({ lat: null, lng: null, label: '', area: '', city: '' });
  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editingLocation, setEditingLocation] = useState<Deal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const totalViews = myDeals.reduce((a, b) => a + b.views, 0);
  const totalClicks = myDeals.reduce((a, b) => a + b.clicks, 0);
  const missingLocation = myDeals.filter(d => d.latitude === null || d.longitude === null).length;
  const avgHealth = myDeals.length
    ? Math.round(myDeals.reduce((sum, d) => sum + computeDealHealth(d), 0) / myDeals.length)
    : 0;
  const avgCtr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0.0';
  const setupDone = [shopName, shopPhone, shopAbout].filter((v) => v.trim().length > 0).length;

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace('/login'); return; }
      const role = data.session.user.user_metadata?.role;
      if (role === 'user') { router.replace('/user/profile'); return; }

      const profile = (data.session.user.user_metadata?.business_profile || {}) as Record<string, string>;
      setShopName(profile.shop_name || '');
      setShopPhone(profile.phone || '');
      setShopWhatsapp(profile.whatsapp || '');
      setShopWebsite(profile.website || '');
      setShopInstagram(profile.instagram || '');
      setShopAbout(profile.about || '');
    };
    init();
  }, [router]);

  const saveBusinessProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setProfileSaving(false); return; }
    const { error } = await supabase.auth.updateUser({
      data: {
        ...auth.user.user_metadata,
        role: 'business',
        business_profile: {
          shop_name: shopName.trim(),
          phone: shopPhone.trim(),
          whatsapp: shopWhatsapp.trim(),
          website: shopWebsite.trim(),
          instagram: shopInstagram.trim(),
          about: shopAbout.trim(),
        },
      },
    });
    setProfileSaving(false);
    setProfileMsg(error ? error.message : 'Profile updated');
  };

  const fetchMyDeals = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });
    if (!error) setMyDeals((data || []) as Deal[]);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchMyDeals(); }, []);

  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalLocation = location;
    if ((finalLocation.lat === null || finalLocation.lng === null) && finalLocation.label.trim()) {
      const resolved = await forwardGeocode(finalLocation.label.trim());
      if (resolved) finalLocation = resolved;
    }

    if (finalLocation.lat === null || finalLocation.lng === null) {
      setLocationError('Please select a valid location from suggestions or use current location.');
      return;
    }
    setSubmitting(true);
    setLocationError(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setSubmitting(false); return; }

    const uploadedUrls = await uploadDealImages(imageFiles);
    const imageUrl = uploadedUrls[0] || null;
    const basePayload = {
      title,
      description: description.trim(),
      valid_till_date: validTillDate || null,
      category: category || null,
      image: imageUrl,
      user_id: auth.user.id,
      latitude: finalLocation.lat,
      longitude: finalLocation.lng,
      area: finalLocation.area || null,
      city: finalLocation.city || null,
      offer_price: offerPrice || null,
      original_price: originalPrice || null,
      discount_label: discountLabel || null,
      coupon_code: couponCode || null,
      terms: terms || null,
      redemption_mode: redemption || null,
      contact_phone: shopPhone || null,
      contact_whatsapp: shopWhatsapp || null,
      status: 'active',
    };

    const insertResult = await insertDealWithFallback({
      ...basePayload,
      image_urls: uploadedUrls.length ? uploadedUrls : null,
    });
    const inserted = insertResult.data;
    const insertError = insertResult.error;

    if (insertError || !inserted) {
      setLocationError(insertError?.message || 'Could not add deal. Please try again.');
      setSubmitting(false);
      return;
    }

    if (uploadedUrls.length > 1) {
      const galleryUpdate = await supabase
        .from('deals')
        .update({ image_urls: uploadedUrls })
        .eq('id', inserted.id);
      if (extractMissingDealsColumn(galleryUpdate.error) === 'image_urls') {
        setLocationError('Deal saved, but only first image stored. Run latest DB migration to enable gallery images.');
      }
    }

    // Safety retry: if DB row came back without coordinates, persist again.
    if (inserted.latitude === null || inserted.longitude === null) {
      const { error: fixError } = await supabase
        .from('deals')
        .update({
          latitude: finalLocation.lat,
          longitude: finalLocation.lng,
          area: finalLocation.area || null,
          city: finalLocation.city || null,
        })
        .eq('id', inserted.id);
      if (fixError) {
        setLocationError(fixError.message || 'Deal added, but location save failed.');
      }
    }

    setTitle(''); setDescription(''); setValidTillDate(''); setCategory('');
    setOfferPrice(''); setOriginalPrice(''); setDiscountLabel('');
    setCouponCode(''); setRedemption('in-store'); setTerms('');
    setImageFiles([]);
    setLocation({ lat: null, lng: null, label: '', area: '', city: '' });
    setSubmitting(false);
    fetchMyDeals();
  };

  const handleUpdateDeal = async () => {
    if (!editingDeal) return;
    const existingImages = (editingDeal.image_urls && editingDeal.image_urls.length)
      ? editingDeal.image_urls
      : (editingDeal.image ? [editingDeal.image] : []);
    const newUploads = await uploadDealImages(editImageFiles);
    const mergedImages = [...existingImages, ...newUploads].slice(0, 8);
    const updatedImage = mergedImages[0] || null;
    const baseUpdate = {
      title: editingDeal.title,
      description: editingDeal.description,
      valid_till_date: editingDeal.valid_till_date,
      category: editingDeal.category,
      image: updatedImage,
      offer_price: editingDeal.offer_price || null,
      original_price: editingDeal.original_price || null,
      discount_label: editingDeal.discount_label || null,
      coupon_code: editingDeal.coupon_code || null,
      terms: editingDeal.terms || null,
      redemption_mode: editingDeal.redemption_mode || null,
      status: editingDeal.status || 'active',
    };
    await updateDealWithFallback(editingDeal.id, {
      ...baseUpdate,
      image_urls: mergedImages.length ? mergedImages : null,
    });
    setEditingDeal(null);
    setEditImageFiles([]);
    fetchMyDeals();
  };

  const handleDeleteDeal = async (id: number) => {
    if (!confirm('Delete this deal?')) return;
    await supabase.from('deals').delete().eq('id', id);
    fetchMyDeals();
  };

  const togglePauseDeal = async (deal: Deal) => {
    await supabase.from('deals').update({
      status: deal.status === 'paused' ? 'active' : 'paused',
    }).eq('id', deal.id);
    fetchMyDeals();
  };

  const duplicateDeal = async (deal: Deal) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const baseCopy = {
      title: `${deal.title} (Copy)`,
      description: deal.description,
      valid_till_date: deal.valid_till_date,
      category: deal.category || null,
      image: deal.image || null,
      latitude: deal.latitude,
      longitude: deal.longitude,
      area: deal.area || null,
      city: deal.city || null,
      offer_price: deal.offer_price || null,
      original_price: deal.original_price || null,
      discount_label: deal.discount_label || null,
      coupon_code: deal.coupon_code || null,
      terms: deal.terms || null,
      redemption_mode: deal.redemption_mode || null,
      contact_phone: deal.contact_phone || null,
      contact_whatsapp: deal.contact_whatsapp || null,
      user_id: auth.user.id,
      status: 'active',
    };
    const copyResult = await insertDealWithoutSelectWithFallback({
      ...baseCopy,
      image_urls: deal.image_urls || (deal.image ? [deal.image] : null),
    });
    if (copyResult.error) return;
    fetchMyDeals();
  };

  const extendDeal = async (deal: Deal) => {
    const base = deal.valid_till_date ? new Date(deal.valid_till_date) : new Date();
    base.setDate(base.getDate() + 7);
    await supabase.from('deals').update({
      valid_till_date: base.toISOString().split('T')[0],
    }).eq('id', deal.id);
    fetchMyDeals();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#e0e7ff_0%,_#f8fafc_38%,_#eef2ff_100%)] px-1 pb-16 md:px-4">
      <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
      <div className="pointer-events-none absolute top-10 right-0 h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="relative mb-6 mt-3 overflow-hidden rounded-[1.6rem] border border-indigo-200/70 shadow-[0_18px_45px_-20px_rgba(79,70,229,0.45)] md:mb-8 md:mt-5 md:rounded-[2rem]">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 opacity-95" />
        <div className="relative p-5 text-white md:p-10">
          <h1 className="text-3xl font-bold md:text-4xl">Business Dashboard 🚀</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/90 md:mt-3 md:text-base">Manage your storefront profile, publish offers, and keep every deal map-ready.</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 md:mb-6 md:gap-6 md:grid-cols-3">
        {[
          { label: 'Total Deals', value: myDeals.length },
          { label: 'Total Views', value: totalViews },
          { label: 'Total Clicks', value: totalClicks },
          { label: 'Avg CTR', value: `${avgCtr}%` },
          { label: 'Deal Health', value: `${avgHealth}%` },
        ].map((item, i) => (
          <motion.div key={i} whileHover={{ scale: 1.03 }} className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-lg shadow-indigo-100/30 backdrop-blur md:p-6">
            <p className="text-sm text-slate-500">{item.label}</p>
            <h2 className="mt-1 text-2xl font-bold md:mt-2 md:text-3xl">{item.value}</h2>
          </motion.div>
        ))}
      </div>

      {setupDone < 3 && (
        <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Business setup</p>
          <p className="mt-1 text-sm text-indigo-900">Complete your profile to improve trust and conversions.</p>
          <p className="mt-1 text-xs text-indigo-700">Checklist: shop name, contact number, about section.</p>
        </div>
      )}

      <AnimatePresence>
        {missingLocation > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 mb-6">
            <MapPinOff size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-amber-800 font-semibold text-sm">
                {missingLocation} deal{missingLocation > 1 ? 's' : ''} missing location
              </p>
              <p className="text-amber-700 text-xs mt-0.5">
                Use <strong>Set Location</strong> on the cards below to pin them on the map.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={saveBusinessProfile} className="mb-6 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-indigo-100/30 backdrop-blur md:mb-8 md:p-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold md:mb-6 md:text-xl">
          <Store size={18} /> Business Profile
        </h2>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <input className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Shop Name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          <div className="relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full p-4 pl-10 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Phone Number" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} />
          </div>
          <input className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="WhatsApp Number" value={shopWhatsapp} onChange={(e) => setShopWhatsapp(e.target.value)} />
          <div className="relative">
            <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full p-4 pl-10 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Website URL" value={shopWebsite} onChange={(e) => setShopWebsite(e.target.value)} />
          </div>
          <div className="md:col-span-2 relative">
            <Instagram size={15} className="absolute left-3 top-5 text-gray-400" />
            <input className="w-full p-4 pl-10 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Instagram handle or URL" value={shopInstagram} onChange={(e) => setShopInstagram(e.target.value)} />
          </div>
        </div>
        <textarea className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="About your shop (services, timings, specialties)"
          value={shopAbout}
          onChange={(e) => setShopAbout(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button disabled={profileSaving}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 px-5 rounded-xl font-medium disabled:opacity-60">
            {profileSaving ? 'Saving…' : 'Save Profile'}
          </button>
          {profileMsg && <p className="text-sm text-gray-600">{profileMsg}</p>}
        </div>
      </form>

      {/* ADD DEAL FORM */}
      <form onSubmit={handleAddDeal} className="mb-8 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-xl shadow-indigo-100/30 backdrop-blur md:mb-10 md:p-8">
        <h2 className="text-xl font-semibold mb-6 flex gap-2 items-center">
          <Plus size={18} /> Add New Deal
        </h2>

        <input className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
          placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
          placeholder="What is included in this deal?" value={description} onChange={(e) => setDescription(e.target.value)} />

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="relative">
            <BadgePercent size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full p-4 pl-10 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Discount (e.g. 40% OFF)" value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} />
          </div>
          <div className="relative">
            <Ticket size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full p-4 pl-10 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Coupon Code (optional)" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
          </div>
          <input className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
            placeholder="Offer Price (e.g. ₹499)" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} />
          <input className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
            placeholder="Original Price (e.g. ₹999)" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />
        </div>

        <select className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
          value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Select Category</option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <select className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
            value={redemption} onChange={(e) => setRedemption(e.target.value)}>
            <option value="in-store">In-store only</option>
            <option value="online">Online only</option>
            <option value="both">In-store + Online</option>
          </select>
          <input type="date" className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
            value={validTillDate} onChange={(e) => setValidTillDate(e.target.value)} />
        </div>

        <div className="relative mb-4">
          <FileText size={15} className="absolute left-3 top-4 text-gray-400" />
          <textarea className="w-full p-4 pl-10 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
            placeholder="Terms & conditions (e.g. valid Mon-Fri, one redemption per user)"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">📍 Business Location</label>
          <LocationPicker value={location} onChange={(v) => {
            setLocation(v);
            if (v.lat !== null && v.lng !== null) setLocationError(null);
          }} />
          {locationError && (
            <p className="text-xs text-red-600 mt-2">{locationError}</p>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          multiple
          className="w-full mb-2"
          onChange={(e) => setImageFiles(Array.from(e.target.files || []).slice(0, 8))}
        />
        <p className="mb-6 text-xs text-slate-500">
          Add up to 8 images. First image is used as cover.
        </p>

        <button disabled={submitting}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-60">
          {submitting ? 'Adding deal…' : 'Add Deal'}
        </button>
      </form>

      {/* DEAL LIST */}
      <div className="space-y-6">
        {myDeals.map((deal) => {
          const hasLoc = deal.latitude !== null && deal.longitude !== null;
          const locText = [deal.area, deal.city].filter(Boolean).join(', ')
            || (hasLoc ? 'Coords saved (no area name)' : '');

          return (
            <motion.div key={deal.id} whileHover={{ scale: 1.01 }} className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-lg shadow-indigo-100/30 backdrop-blur md:p-6">
              {(deal.image_urls?.[0] || deal.image) && (
                <div className="relative mb-4">
                  <img src={deal.image_urls?.[0] || deal.image || ''} alt="deal" className="w-full h-48 object-cover rounded-xl" />
                  {!!(deal.image_urls && deal.image_urls.length > 1) && (
                    <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                      +{deal.image_urls.length - 1} more
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-slate-900 md:text-xl">{deal.title}</h3>
                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-gray-600">{deal.description}</p>
                  {deal.category && (
                    <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mt-1 capitalize">
                      {getCategoryLabel(deal.category)}
                    </span>
                  )}
                </div>
                {hasLoc ? (
                  <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full shrink-0">
                    <MapPin size={11} /> Pinned
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full shrink-0">
                    <MapPinOff size={11} /> No location
                  </span>
                )}
              </div>

              <p className="mt-2 flex items-center gap-1 text-xs md:text-sm">
                <MapPin size={13} className={hasLoc ? 'text-purple-400' : 'text-gray-300'} />
                {locText
                  ? <span className="text-gray-600">{locText}</span>
                  : <span className="text-gray-400 italic">No location - won&apos;t appear on map</span>
                }
              </p>

              <div className="flex gap-6 mt-3 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Eye size={16} /> {deal.views}</span>
                <span className="flex items-center gap-1"><MousePointerClick size={16} /> {deal.clicks}</span>
                <span className="text-xs rounded-full px-2 py-0.5 bg-slate-100 text-slate-700">
                  Health {computeDealHealth(deal)}%
                </span>
              </div>

              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  onClick={() =>
                    setEditingDeal({
                      ...deal,
                      image_urls: (deal.image_urls && deal.image_urls.length)
                        ? deal.image_urls
                        : (deal.image ? [deal.image] : []),
                    })
                  }
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Pencil size={15} /> Edit
                </button>
                <button onClick={() => handleDeleteDeal(deal.id)} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
                  <Trash2 size={15} /> Delete
                </button>
                <button onClick={() => setEditingLocation(deal)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition
                    ${hasLoc ? 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200'
                      : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'}`}>
                  <MapPin size={14} />
                  {hasLoc ? 'Edit Location' : 'Set Location'}
                </button>
                <button onClick={() => togglePauseDeal(deal)}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800">
                  {deal.status === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <button onClick={() => duplicateDeal(deal)} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
                  Duplicate
                </button>
                <button onClick={() => extendDeal(deal)} className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800">
                  +7 days
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {editingDeal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-semibold mb-4">Edit Deal</h2>
            <input className="w-full p-3 border rounded-xl mb-3" value={editingDeal.title}
              onChange={(e) => setEditingDeal({ ...editingDeal, title: e.target.value })} />
            <textarea className="w-full p-3 border rounded-xl mb-3" value={editingDeal.description}
              onChange={(e) => setEditingDeal({ ...editingDeal, description: e.target.value })} />

            <div className="grid grid-cols-2 gap-2 mb-3">
              <input
                className="w-full p-3 border rounded-xl text-sm"
                placeholder="Offer price"
                value={editingDeal.offer_price || ''}
                onChange={(e) => setEditingDeal({ ...editingDeal, offer_price: e.target.value })}
              />
              <input
                className="w-full p-3 border rounded-xl text-sm"
                placeholder="Original price"
                value={editingDeal.original_price || ''}
                onChange={(e) => setEditingDeal({ ...editingDeal, original_price: e.target.value })}
              />
              <input
                className="w-full p-3 border rounded-xl text-sm"
                placeholder="Discount label"
                value={editingDeal.discount_label || ''}
                onChange={(e) => setEditingDeal({ ...editingDeal, discount_label: e.target.value })}
              />
              <input
                className="w-full p-3 border rounded-xl text-sm"
                placeholder="Coupon code"
                value={editingDeal.coupon_code || ''}
                onChange={(e) => setEditingDeal({ ...editingDeal, coupon_code: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <select
                className="w-full p-3 border rounded-xl text-sm"
                value={editingDeal.category || ''}
                onChange={(e) => setEditingDeal({ ...editingDeal, category: e.target.value || null })}
              >
                <option value="">Select category</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={`edit-${opt.value}`} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                className="w-full p-3 border rounded-xl text-sm"
                value={editingDeal.redemption_mode || 'in-store'}
                onChange={(e) => setEditingDeal({ ...editingDeal, redemption_mode: e.target.value })}
              >
                <option value="in-store">In-store only</option>
                <option value="online">Online only</option>
                <option value="both">In-store + Online</option>
              </select>
            </div>

            <input
              type="date"
              className="w-full p-3 border rounded-xl text-sm mb-3"
              value={editingDeal.valid_till_date || ''}
              onChange={(e) => setEditingDeal({ ...editingDeal, valid_till_date: e.target.value || null })}
            />

            <textarea
              className="w-full p-3 border rounded-xl mb-3 text-sm"
              placeholder="Terms & conditions"
              value={editingDeal.terms || ''}
              onChange={(e) => setEditingDeal({ ...editingDeal, terms: e.target.value })}
            />

            {((editingDeal.image_urls && editingDeal.image_urls.length) || editingDeal.image) && (
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-600">Current Images</p>
                <div className="grid grid-cols-3 gap-2">
                  {(editingDeal.image_urls && editingDeal.image_urls.length
                    ? editingDeal.image_urls
                    : (editingDeal.image ? [editingDeal.image] : [])
                  ).map((img, idx) => (
                    <div key={`${img}-${idx}`} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <img src={img} alt={`Deal image ${idx + 1}`} className="h-20 w-full object-cover" />
                      <div className="space-y-1 p-1">
                        <button
                          type="button"
                          onClick={() => {
                            const current = editingDeal.image_urls && editingDeal.image_urls.length
                              ? [...editingDeal.image_urls]
                              : (editingDeal.image ? [editingDeal.image] : []);
                            const next = current.filter((_, i) => i !== idx);
                            setEditingDeal({
                              ...editingDeal,
                              image_urls: next,
                              image: next[0] || null,
                            });
                          }}
                          className="w-full rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"
                        >
                          Delete
                        </button>
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const current = editingDeal.image_urls && editingDeal.image_urls.length
                                ? [...editingDeal.image_urls]
                                : (editingDeal.image ? [editingDeal.image] : []);
                              const picked = current[idx];
                              const next = [picked, ...current.filter((_, i) => i !== idx)];
                              setEditingDeal({
                                ...editingDeal,
                                image_urls: next,
                                image: next[0] || null,
                              });
                            }}
                            className="w-full rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100"
                          >
                            Set cover
                          </button>
                        )}
                      </div>
                      {idx === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Cover
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              multiple
              className="w-full mb-1"
              onChange={(e) => setEditImageFiles(Array.from(e.target.files || []).slice(0, 8))}
            />
            <p className="mb-4 text-xs text-slate-500">Upload more images to extend gallery (max 8 total).</p>
            <div className="flex gap-3">
              <button onClick={handleUpdateDeal} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl">Save</button>
              <button onClick={() => { setEditingDeal(null); setEditImageFiles([]); }} className="flex-1 border py-3 rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editingLocation && (
        <EditLocationModal deal={editingLocation} onSave={fetchMyDeals} onClose={() => setEditingLocation(null)} />
      )}
    </main>
  );
}
