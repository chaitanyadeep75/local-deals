'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Pencil,
  Eye,
  MousePointerClick,
} from 'lucide-react';
import { motion } from 'framer-motion';

type Deal = {
  id: number;
  title: string;
  description: string;
  valid_till_date: string | null;
  views: number;
  clicks: number;
  category: string | null;
  image: string | null;
};

export default function BusinessDashboard() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validTillDate, setValidTillDate] = useState('');
  const [category, setCategory] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

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
        'id, title, description, valid_till_date, views, clicks, category, image'
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

    let imageUrl: string | null = null;

    if (imageFile) {
      const fileName = `${Date.now()}-${imageFile.name}`;
      await supabase.storage
        .from('deal-images')
        .upload(fileName, imageFile);

      const { data } = supabase.storage
        .from('deal-images')
        .getPublicUrl(fileName);

      imageUrl = data.publicUrl;
    }

    await supabase.from('deals').insert({
      title,
      description,
      valid_till_date: validTillDate || null,
      category: category || null,
      image: imageUrl,
      user_id: auth.user.id,
    });

    setTitle('');
    setDescription('');
    setValidTillDate('');
    setCategory('');
    setImageFile(null);

    fetchMyDeals();
  };

  /* ---------------- UPDATE DEAL ---------------- */
  const handleUpdateDeal = async () => {
    if (!editingDeal) return;

    let updatedImage = editingDeal.image;

    if (editImageFile) {
      const fileName = `${Date.now()}-${editImageFile.name}`;
      await supabase.storage
        .from('deal-images')
        .upload(fileName, editImageFile);

      const { data } = supabase.storage
        .from('deal-images')
        .getPublicUrl(fileName);

      updatedImage = data.publicUrl;
    }

    await supabase
      .from('deals')
      .update({
        title: editingDeal.title,
        description: editingDeal.description,
        valid_till_date: editingDeal.valid_till_date,
        category: editingDeal.category,
        image: updatedImage,
      })
      .eq('id', editingDeal.id);

    setEditingDeal(null);
    setEditImageFile(null);
    fetchMyDeals();
  };

  /* ---------------- DELETE DEAL ---------------- */
  const handleDeleteDeal = async (id: number) => {
    if (!confirm('Delete this deal?')) return;
    await supabase.from('deals').delete().eq('id', id);
    fetchMyDeals();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 pb-16">

      {/* HERO */}
      <div className="relative rounded-3xl overflow-hidden mb-8 mt-6 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 opacity-95" />
        <div className="relative p-10 text-white">
          <h1 className="text-4xl font-bold">
            Business Dashboard 🚀
          </h1>
          <p className="mt-3 text-white/90">
            Manage and grow your deals effortlessly
          </p>
        </div>
      </div>

      {/* STATS */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {[ 
          { label: 'Total Deals', value: myDeals.length },
          { label: 'Total Views', value: totalViews },
          { label: 'Total Clicks', value: totalClicks },
        ].map((item, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.05 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <p className="text-gray-500">{item.label}</p>
            <h2 className="text-3xl font-bold mt-2">
              {item.value}
            </h2>
          </motion.div>
        ))}
      </div>

      {/* ADD DEAL FORM */}
      <form
        onSubmit={handleAddDeal}
        className="bg-white rounded-2xl shadow-xl p-8 mb-10"
      >
        <h2 className="text-xl font-semibold mb-6 flex gap-2 items-center">
          <Plus size={18} /> Add New Deal
        </h2>

        <input
          className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea
          className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <select
          className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Select Category</option>
          <option value="food">Food</option>
          <option value="spa">Spa</option>
          <option value="electronics">Electronics</option>
          <option value="fashion">Fashion</option>
          <option value="automobile">Automobile</option>
          <option value="fitness">Fitness</option>
        </select>

        <input
          type="date"
          className="w-full p-4 border rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
          value={validTillDate}
          onChange={(e) => setValidTillDate(e.target.value)}
        />

        <input
          type="file"
          accept="image/*"
          className="w-full mb-6"
          onChange={(e) =>
            e.target.files &&
            setImageFile(e.target.files[0])
          }
        />

        <button className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-semibold hover:opacity-90 transition">
          Add Deal
        </button>
      </form>

      {/* DEAL LIST */}
      <div className="space-y-6">
        {myDeals.map((deal) => (
          <motion.div
            key={deal.id}
            whileHover={{ scale: 1.02 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            {deal.image && (
              <img
                src={deal.image}
                alt="deal"
                className="w-full h-48 object-cover rounded-xl mb-4"
              />
            )}

            <h3 className="text-xl font-semibold">
              {deal.title}
            </h3>
            <p className="text-gray-600">
              {deal.description}
            </p>

            {deal.category && (
              <p className="text-sm text-purple-600 mt-1">
                Category: {deal.category}
              </p>
            )}

            <div className="flex gap-6 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Eye size={16} /> {deal.views}
              </span>
              <span className="flex items-center gap-1">
                <MousePointerClick size={16} />{' '}
                {deal.clicks}
              </span>
            </div>

            <div className="flex gap-6 mt-4">
              <button
                onClick={() => setEditingDeal(deal)}
                className="text-blue-600 flex items-center gap-1"
              >
                <Pencil size={16} /> Edit
              </button>

              <button
                onClick={() =>
                  handleDeleteDeal(deal.id)
                }
                className="text-red-600 flex items-center gap-1"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* EDIT MODAL */}
      {editingDeal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-semibold mb-4">
              Edit Deal
            </h2>

            <input
              className="w-full p-3 border rounded-xl mb-3"
              value={editingDeal.title}
              onChange={(e) =>
                setEditingDeal({
                  ...editingDeal,
                  title: e.target.value,
                })
              }
            />

            <textarea
              className="w-full p-3 border rounded-xl mb-3"
              value={editingDeal.description}
              onChange={(e) =>
                setEditingDeal({
                  ...editingDeal,
                  description: e.target.value,
                })
              }
            />

            <input
              type="file"
              accept="image/*"
              className="w-full mb-4"
              onChange={(e) =>
                e.target.files &&
                setEditImageFile(e.target.files[0])
              }
            />

            <div className="flex gap-3">
              <button
                onClick={handleUpdateDeal}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl"
              >
                Save
              </button>
              <button
                onClick={() => setEditingDeal(null)}
                className="flex-1 border py-3 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
