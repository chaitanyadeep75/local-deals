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
  X
} from 'lucide-react';

type Deal = {
  id: number;
  title: string;
  description: string;
  valid_till: string;
};

type Toast = {
  message: string;
  type: 'success' | 'error';
};

export default function BusinessDashboard() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validTill, setValidTill] = useState('');
  const [loading, setLoading] = useState(false);

  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  /* ---------- TOAST ---------- */
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ---------- AUTH ---------- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login');
    });
  }, [router]);

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

  /* ---------- ADD ---------- */
  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();

    const { error } = await supabase.from('deals').insert({
      title,
      description,
      valid_till: validTill,
      user_id: auth.user?.id,
    });

    setLoading(false);

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    showToast('Deal added', 'success');
    setTitle('');
    setDescription('');
    setValidTill('');
    fetchMyDeals();
  };

  /* ---------- UPDATE ---------- */
  const handleUpdateDeal = async () => {
    if (!editingDeal) return;

    const { error } = await supabase
      .from('deals')
      .update({
        title: editingDeal.title,
        description: editingDeal.description,
        valid_till: editingDeal.valid_till,
      })
      .eq('id', editingDeal.id);

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    showToast('Deal updated', 'success');
    setEditingDeal(null);
    fetchMyDeals();
  };

  /* ---------- DELETE ---------- */
  const handleDeleteDeal = async (id: number) => {
    const { error } = await supabase.from('deals').delete().eq('id', id);

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    showToast('Deal deleted', 'success');
    fetchMyDeals();
  };

  /* ---------- LOGOUT ---------- */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-6 relative">
      {/* TOAST */}
      {toast && (
        <div
          className={`fixed top-5 inset-x-4 md:inset-x-auto md:right-5 px-4 py-3 rounded text-white z-50
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
        >
          {toast.message}
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Business Dashboard</h1>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-3 rounded"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ADD DEAL */}
        <form onSubmit={handleAddDeal} className="bg-white p-5 rounded shadow">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Plus size={18} /> Add Deal
          </h2>

          <input
            className="w-full p-3 border rounded mb-3"
            placeholder="Deal title"
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
            className="w-full p-3 border rounded mb-4"
            placeholder="Valid till"
            value={validTill}
            onChange={(e) => setValidTill(e.target.value)}
          />

          <button
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            {loading ? 'Adding...' : 'Add Deal'}
          </button>
        </form>

        {/* MY DEALS */}
        <div>
          <h2 className="font-semibold mb-4">My Deals</h2>

          <div className="space-y-4">
            {myDeals.map((deal) => (
              <div key={deal.id} className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold">{deal.title}</h3>
                <p>{deal.description}</p>
                <p className="text-sm text-gray-500">
                  Valid till {deal.valid_till}
                </p>

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
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingDeal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-full mx-4 md:max-w-md">
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
                setEditingDeal({ ...editingDeal, description: e.target.value })
              }
            />

            <input
              className="w-full p-3 border rounded mb-4"
              value={editingDeal.valid_till}
              onChange={(e) =>
                setEditingDeal({ ...editingDeal, valid_till: e.target.value })
              }
            />

            <div className="flex flex-col md:flex-row gap-2">
              <button
                onClick={handleUpdateDeal}
                className="flex-1 bg-black text-white py-3 rounded flex items-center justify-center gap-2"
              >
                <Save size={16} /> Save
              </button>
              <button
                onClick={() => setEditingDeal(null)}
                className="flex-1 border py-3 rounded flex items-center justify-center gap-2"
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
