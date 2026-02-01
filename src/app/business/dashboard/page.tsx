'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Pencil,
  Trash2,
  LogOut,
  Save,
  X,
  Eye,
  MousePointerClick,
  MapPin,
  LayoutDashboard
} from 'lucide-react';

type Deal = {
  id: number;
  title: string;
  description: string;
  valid_till_date: string | null;
  views: number;
  clicks: number;
  city: string | null;
};

type Toast = {
  message: string;
  type: 'success' | 'error';
};

export default function BusinessDashboard() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validTillDate, setValidTillDate] = useState('');
  const [loading, setLoading] = useState(false);

  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [city, setCity] = useState<string | null>(null);

  /* ---------- TOAST ---------- */
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ---------- AUTH ---------- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login');
    });
  }, [router]);

  /* ---------- LOCATION ---------- */
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
      );
      const data = await res.json();
      setCity(
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        null
      );
    });
  }, []);

  /* ---------- FETCH DEALS ---------- */
  const fetchMyDeals = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    setMyDeals(data || []);
  };

  useEffect(() => {
    fetchMyDeals();
  }, []);

  /* ---------- STATS ---------- */
  const totalViews = myDeals.reduce((a, b) => a + b.views, 0);
  const totalClicks = myDeals.reduce((a, b) => a + b.clicks, 0);

  /* ---------- ADD ---------- */
  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { error } = await supabase.from('deals').insert({
      title,
      description,
      valid_till_date: validTillDate || null,
      city,
      user_id: auth.user.id,
    });

    setLoading(false);

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    showToast('Deal added successfully', 'success');
    setTitle('');
    setDescription('');
    setValidTillDate('');
    fetchMyDeals();
  };

  /* ---------- DELETE ---------- */
  const handleDeleteDeal = async (id: number) => {
    if (!confirm('Delete this deal?')) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    await supabase
      .from('deals')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    showToast('Deal deleted', 'success');
    fetchMyDeals();
  };

  /* ---------- LOGOUT ---------- */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <main className="space-y-8">
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded text-white
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2">
            <LayoutDashboard /> Dashboard
          </h1>
          {city && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <MapPin size={14} /> {city}
            </p>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-lg"
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm text-gray-500">Total Deals</p>
          <h2 className="text-3xl font-extrabold mt-2">{myDeals.length}</h2>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Eye size={14} /> Views
          </p>
          <h2 className="text-3xl font-extrabold mt-2">{totalViews}</h2>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <MousePointerClick size={14} /> Clicks
          </p>
          <h2 className="text-3xl font-extrabold mt-2">{totalClicks}</h2>
        </div>
      </section>

      {/* ADD DEAL */}
      <form onSubmit={handleAddDeal} className="card space-y-4">
        <h2 className="font-bold flex items-center gap-2">
          <Plus size={16} /> Add New Deal
        </h2>

        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" required />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" />
        <input type="date" value={validTillDate} onChange={e => setValidTillDate(e.target.value)} />

        <button className="btn-primary w-full">
          {loading ? 'Saving...' : 'Add Deal'}
        </button>
      </form>

      {/* DEAL LIST */}
      <section className="space-y-4">
        {myDeals.map(deal => (
          <div key={deal.id} className="card flex justify-between items-start">
            <div>
              <h3 className="font-bold">{deal.title}</h3>
              <p className="text-sm">{deal.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                {deal.views} views • {deal.clicks} clicks
              </p>
            </div>
            <button
              onClick={() => handleDeleteDeal(deal.id)}
              className="text-red-500"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}
