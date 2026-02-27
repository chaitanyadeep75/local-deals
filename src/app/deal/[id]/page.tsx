'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, Pencil, Eye, MousePointerClick,
  MapPin, LocateFixed, AlertCircle, Info, MapPinOff,
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
  latitude: number | null;
  longitude: number | null;
  area: string | null;
  city: string | null;
};

type LocationValue = {
  lat: number | null;
  lng: number | null;
  label: string;
  area: string;
  city: string;
};

/* ─────────────────────────────────────────
   PARSE MAPBOX FEATURE → area + city
   Handles Indian address context correctly
───────────────────────────────────────── */
function parseMapboxFeature(feature: any): { area: string; city: string } {
  const context: any[] = feature.context || [];

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
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=locality,place,neighborhood,address&limit=1`
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

async function getLocationByIP(): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if (data.latitude && data.longitude) return { lat: data.latitude, lng: data.longitude };
    return null;
  } catch { return null; }
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
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'error' | 'denied' | 'ip-fallback'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 350);
  };

  const selectSuggestion = (feature: any) => {
    const [lng, lat] = feature.center;
    const { area, city } = parseMapboxFeature(feature);
    onChange({ lat, lng, label: feature.place_name, area, city });
    setQuery(feature.place_name);
    setSuggestions([]);
    setGeoStatus('idle');
  };

  const tryIPFallback = async (fromDenied = false) => {
    const ipLoc = await getLocationByIP();
    if (ipLoc) {
      const geo = await reverseGeocode(ipLoc.lat, ipLoc.lng);
      onChange({ lat: ipLoc.lat, lng: ipLoc.lng, ...geo });
      setQuery(geo.label);
      setGeoStatus('ip-fallback');
    } else {
      setGeoStatus(fromDenied ? 'denied' : 'error');
    }
    setGeoLoading(false);
  };

  const useCurrentLocation = () => {
    setGeoLoading(true);
    setGeoStatus('idle');
    if (!navigator.geolocation) { tryIPFallback(); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const geo = await reverseGeocode(lat, lng);
        onChange({ lat, lng, ...geo });
        setQuery(geo.label);
        setGeoLoading(false);
        setSuggestions([]);
      },
      async (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus('denied');
          await tryIPFallback(true);
        } else {
          await tryIPFallback();
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
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
    if (!location.lat || !location.lng) return;
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

/* ─────────────────────────────────────────
   DASHBOARD PAGE
───────────────────────────────────────── */
export default function BusinessDashboard() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validTillDate, setValidTillDate] = useState('');
  const [category, setCategory] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [location, setLocation] = useState<LocationValue>({ lat: null, lng: null, label: '', area: '', city: '' });
  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editingLocation, setEditingLocation] = useState<Deal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalViews = myDeals.reduce((a, b) => a + b.views, 0);
  const totalClicks = myDeals.reduce((a, b) => a + b.clicks, 0);
  const missingLocation = myDeals.filter(d => !d.latitude || !d.longitude).length;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login');
    });
  }, [router]);

  const fetchMyDeals = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data } = await supabase
      .from('deals')
      .select('id, title, description, valid_till_date, views, clicks, category, image, latitude, longitude, area, city')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });
    setMyDeals(data || []);
  };

  useEffect(() => { fetchMyDeals(); }, []);

  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setSubmitting(false); return; }

    let imageUrl: string | null = null;
    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.name}`;
      await supabase.storage.from('deal-images').upload(fileName, imageFile);
      const { data } = supabase.storage.from('deal-images').getPublicUrl(fileName);
      imageUrl = data.publicUrl;
    }

    await supabase.from('deals').insert({
      title, description,
      valid_till_date: validTillDate || null,
      category: category || null,
      image: imageUrl,
      user_id: auth.user.id,
      latitude: location.lat,
      longitude: location.lng,
      area: location.area || null,
      city: location.city || null,
    });

    setTitle(''); setDescription(''); setValidTillDate(''); setCategory('');
    setImageFile(null);
    setLocation({ lat: null, lng: null, label: '', area: '', city: '' });
    setSubmitting(false);
    fetchMyDeals();
  };

  const handleUpdateDeal = async () => {
    if (!editingDeal) return;
    let updatedImage = editingDeal.image;
    if (editImageFile) {
      const fileName = `${Date.now()}-${editImageFile.name}`;
      await supabase.storage.from('deal-images').upload(fileName, editImageFile);
      const { data } = supabase.storage.from('deal-images').getPublicUrl(fileName);
      updatedImage = data.publicUrl;
    }
    await supabase.from('deals').update({
      title: editingDeal.title,
      description: editingDeal.description,
      valid_till_date: editingDeal.valid_till_date,
      category: editingDeal.category,
      image: updatedImage,
    }).eq('id', editingDeal.id);
    setEditingDeal(null);
    setEditImageFile(null);
    fetchMyDeals();
  };

  const handleDeleteDeal = async (id: number) => {
    if (!confirm('Delete this deal?')) return;
    await supabase.from('deals').delete().eq('id', id);
    fetchMyDeals();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 pb-16">
      <div className="relative rounded-3xl overflow-hidden mb-8 mt-6 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 opacity-95" />
        <div className="relative p-10 text-white">
          <h1 className="text-4xl font-bold">Business Dashboard 🚀</h1>
          <p className="mt-3 text-white/90">Manage and grow your deals effortlessly</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {[
          { label: 'Total Deals', value: myDeals.length },
          { label: 'Total Views', value: totalViews },
          { label: 'Total Clicks', value: totalClicks },
        ].map((item, i) => (
          <motion.div key={i} whileHover={{ scale: 1.05 }} className="bg-white rounded-2xl shadow-lg p-6">
            <p className="text-gray-500">{item.label}</p>
            <h2 className="text-3xl font-bold mt-2">{item.value}</h2>
          </motion.div>
        ))}
      </div>

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
                Click <strong>"+ Add Location"</strong> on the cards below to pin them on the map.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD DEAL FORM */}
      <form onSubmit={handleAddDeal} className="bg-white rounded-2xl shadow-xl p-8 mb-10">
        <h2 className="text-xl font-semibold mb-6 flex gap-2 items-center">
          <Plus size={18} /> Add New Deal
        </h2>

        <input className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
          placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
          placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <select className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
          value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Select Category</option>
          <option value="food">Food</option>
          <option value="spa">Spa</option>
          <option value="electronics">Electronics</option>
          <option value="fashion">Fashion</option>
          <option value="automobile">Automobile</option>
          <option value="rental bikes and cars">Rental Bikes and Cars</option>
          <option value="fitness">Fitness</option>
        </select>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">📍 Business Location</label>
          <LocationPicker value={location} onChange={setLocation} />
        </div>

        <input type="date" className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
          value={validTillDate} onChange={(e) => setValidTillDate(e.target.value)} />
        <input type="file" accept="image/*" className="w-full mb-6"
          onChange={(e) => e.target.files && setImageFile(e.target.files[0])} />

        <button disabled={submitting}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-60">
          {submitting ? 'Adding deal…' : 'Add Deal'}
        </button>
      </form>

      {/* DEAL LIST */}
      <div className="space-y-6">
        {myDeals.map((deal) => {
          const hasLoc = !!(deal.latitude && deal.longitude);
          const locText = [deal.area, deal.city].filter(Boolean).join(', ')
            || (hasLoc ? 'Coords saved (no area name)' : '');

          return (
            <motion.div key={deal.id} whileHover={{ scale: 1.01 }} className="bg-white rounded-2xl shadow-lg p-6">
              {deal.image && <img src={deal.image} alt="deal" className="w-full h-48 object-cover rounded-xl mb-4" />}

              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-semibold truncate">{deal.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{deal.description}</p>
                  {deal.category && (
                    <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mt-1 capitalize">
                      {deal.category}
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

              <p className="text-sm mt-2 flex items-center gap-1">
                <MapPin size={13} className={hasLoc ? 'text-purple-400' : 'text-gray-300'} />
                {locText
                  ? <span className="text-gray-600">{locText}</span>
                  : <span className="text-gray-400 italic">No location — won't appear on map</span>
                }
              </p>

              <div className="flex gap-6 mt-3 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Eye size={16} /> {deal.views}</span>
                <span className="flex items-center gap-1"><MousePointerClick size={16} /> {deal.clicks}</span>
              </div>

              <div className="flex flex-wrap gap-3 mt-4">
                <button onClick={() => setEditingDeal(deal)} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                  <Pencil size={15} /> Edit
                </button>
                <button onClick={() => handleDeleteDeal(deal.id)} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700">
                  <Trash2 size={15} /> Delete
                </button>
                <button onClick={() => setEditingLocation(deal)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition ml-auto
                    ${hasLoc ? 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200'
                      : 'text-white bg-amber-500 hover:bg-amber-600 shadow-sm'}`}>
                  <MapPin size={14} />
                  {hasLoc ? 'Edit Location' : '+ Add Location'}
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
            <input type="file" accept="image/*" className="w-full mb-4"
              onChange={(e) => e.target.files && setEditImageFile(e.target.files[0])} />
            <div className="flex gap-3">
              <button onClick={handleUpdateDeal} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl">Save</button>
              <button onClick={() => setEditingDeal(null)} className="flex-1 border py-3 rounded-xl">Cancel</button>
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