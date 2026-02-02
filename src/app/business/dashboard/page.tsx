'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Eye,
  MousePointerClick,
  MapPin,
} from 'lucide-react';

type Deal = {
  id: number;
  title: string;
  description: string;
  valid_till_date: string | null;
  views: number;
  clicks: number;
  city: string | null;
  area: string | null;
};

export default function BusinessDashboard() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validTillDate, setValidTillDate] = useState('');

  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  const totalViews = myDeals.reduce((a, b) => a + b.views, 0);
  const totalClicks = myDeals.reduce((a, b) => a + b.clicks, 0);

  /* ---------------- AUTH ---------------- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login');
    });
  }, [router]);

  /* ---------------- FETCH DEALS ---------------- */
  const fetchMyDeals = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data } = await supabase
      .from('deals')
      .select(
        'id, title, description, valid_till_date, views, clicks, city, area'
      )
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    setMyDeals(data || []);
  };

  useEffect(() => {
    fetchMyDeals();
  }, []);

  /* ---------------- ADD DEAL ---------------- */
  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    await supabase.from('deals').insert({
      title,
      description,
      valid_till_date: validTillDate || null,
      user_id: auth.user.id,
    });

    setTitle('');
    setDescription('');
    setValidTillDate('');
    fetchMyDeals();
  };

  /* ---------------- UPDATE DEAL ---------------- */
  const handleUpdateDeal = async () => {
    if (!editingDeal) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    await supabase
      .from('deals')
      .update({
        title: editingDeal.title,
        description: editingDeal.description,
        valid_till_date: editingDeal.valid_till_date,
      })
      .eq('id', editingDeal.id)
      .eq('user_id', auth.user.id);

    setEditingDeal(null);
    fetchMyDeals();
  };

  /* ---------------- DELETE DEAL ---------------- */
  const handleDeleteDeal = async (id: number) => {
    if (!confirm('Delete this deal?')) return;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    await supabase
      .from('deals')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    fetchMyDeals();
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-6">
      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-sm text-gray-500">Total Deals</p>
          <h2 className="text-2xl font-bold">{myDeals.length}</h2>
        </div>
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-sm text-gray-500">Views</p>
          <h2 className="text-2xl font-bold">{totalViews}</h2>
        </div>
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-sm text-gray-500">Clicks</p>
          <h2 className="text-2xl font-bold">{totalClicks}</h2>
        </div>
      </div>

      {/* ADD DEAL (UNCHANGED UI) */}
      <form
        onSubmit={handleAddDeal}
        className="bg-white rounded-xl shadow p-6 mb-6"
      >
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Plus size={18} /> Add New Deal
        </h2>

        <input
          className="w-full p-3 border rounded mb-3"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea
          className="w-full p-3 border rounded mb-3"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="date"
          className="w-full p-3 border rounded mb-4"
          value={validTillDate}
          onChange={(e) => setValidTillDate(e.target.value)}
        />

        <button className="w-full bg-black text-white py-3 rounded">
          Add Deal
        </button>
      </form>

      {/* DEAL LIST */}
      <div className="space-y-4">
        {myDeals.map((deal) => (
          <div
            key={deal.id}
            className="bg-white rounded-xl shadow p-5"
          >
            <h3 className="font-semibold text-lg">{deal.title}</h3>
            <p className="text-gray-600">{deal.description}</p>

            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <MapPin size={14} />
              {deal.area
                ? `${deal.area}, ${deal.city}`
                : deal.city || 'Nearby'}
            </p>

            <div className="flex gap-4 text-xs text-gray-500 mt-2">
              <span className="flex items-center gap-1">
                <Eye size={14} /> {deal.views}
              </span>
              <span className="flex items-center gap-1">
                <MousePointerClick size={14} /> {deal.clicks}
              </span>
            </div>

            <div className="flex gap-4 mt-3">
              <button
                onClick={() => setEditingDeal(deal)}
                className="flex items-center gap-1 text-blue-600"
              >
                <Pencil size={16} /> Edit
              </button>
              <button
                onClick={() => handleDeleteDeal(deal.id)}
                className="flex items-center gap-1 text-red-600"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* EDIT MODAL */}
      {editingDeal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Pencil size={18} /> Edit Deal
            </h2>

            <input
              className="w-full p-3 border rounded mb-3"
              value={editingDeal.title}
              onChange={(e) =>
                setEditingDeal({ ...editingDeal, title: e.target.value })
              }
            />

            <textarea
              className="w-full p-3 border rounded mb-3"
              value={editingDeal.description}
              onChange={(e) =>
                setEditingDeal({
                  ...editingDeal,
                  description: e.target.value,
                })
              }
            />

            <input
              type="date"
              className="w-full p-3 border rounded mb-4"
              value={editingDeal.valid_till_date || ''}
              onChange={(e) =>
                setEditingDeal({
                  ...editingDeal,
                  valid_till_date: e.target.value || null,
                })
              }
            />

            <div className="flex gap-2">
              <button
                onClick={handleUpdateDeal}
                className="flex-1 bg-black text-white py-3 rounded flex justify-center gap-2"
              >
                <Save size={16} /> Save
              </button>
              <button
                onClick={() => setEditingDeal(null)}
                className="flex-1 border py-3 rounded flex justify-center gap-2"
              >
                <X size={16} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
