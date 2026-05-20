import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { CATEGORY_OPTIONS } from '../../lib/categories';

type Deal = {
  id: number;
  title: string;
  description: string;
  offer_price: string | null;
  original_price: string | null;
  category: string | null;
  status: string | null;
  created_at: string;
  views: number | null;
  clicks: number | null;
};

const EMPTY_FORM = {
  title: '', description: '', offer_price: '', original_price: '',
  discount_label: '', category: '', city: '', area: '',
  coupon_code: '', contact_phone: '', valid_till_date: '',
};

export default function BusinessDashboard() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/(tabs)/account'); return; }
      setUserId(data.user.id);
    });
  }, []);

  const fetchDeals = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('deals')
      .select('id,title,description,offer_price,original_price,category,status,created_at,views,clicks')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setDeals((data as Deal[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const handlePost = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      Alert.alert('Required', 'Title and description are required.');
      return;
    }
    if (!userId) return;
    setSubmitting(true);
    const { error } = await supabase.from('deals').insert({
      user_id: userId,
      title: form.title.trim(),
      description: form.description.trim(),
      offer_price: form.offer_price || null,
      original_price: form.original_price || null,
      discount_label: form.discount_label || null,
      category: form.category || null,
      city: form.city || null,
      area: form.area || null,
      coupon_code: form.coupon_code || null,
      contact_phone: form.contact_phone || null,
      valid_till_date: form.valid_till_date || null,
      status: 'active',
    });
    setSubmitting(false);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Posted!', 'Your deal is now live.');
    setForm(EMPTY_FORM);
    setShowForm(false);
    fetchDeals();
  };

  const toggleStatus = async (deal: Deal) => {
    const next = deal.status === 'active' ? 'paused' : 'active';
    await supabase.from('deals').update({ status: next }).eq('id', deal.id);
    setDeals((prev) => prev.map((d) => d.id === deal.id ? { ...d, status: next } : d));
  };

  const deleteDeal = (deal: Deal) => {
    Alert.alert('Delete deal', `Delete "${deal.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('deals').delete().eq('id', deal.id);
        setDeals((prev) => prev.filter((d) => d.id !== deal.id));
      }},
    ]);
  };

  const F = ({ label, field, placeholder, multiline, keyboardType }: {
    label: string; field: keyof typeof EMPTY_FORM; placeholder?: string;
    multiline?: boolean; keyboardType?: 'default' | 'numeric' | 'phone-pad';
  }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={form[field]}
        onChangeText={(v) => setForm((p) => ({ ...p, [field]: v }))}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
        style={{
          borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
          paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0f172a',
          minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? 'top' : undefined,
        }}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView>
        {/* Header */}
        <View style={{ backgroundColor: '#4f46e5', padding: 16, paddingTop: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 8 }}>
            <Text style={{ color: '#c7d2fe', fontSize: 13 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff' }}>Business Dashboard</Text>
          <Text style={{ fontSize: 12, color: '#c7d2fe', marginTop: 2 }}>{deals.length} deals posted</Text>
        </View>

        <View style={{ padding: 16 }}>
          {/* Post deal button */}
          <TouchableOpacity
            onPress={() => setShowForm((p) => !p)}
            style={{ backgroundColor: showForm ? '#e0e7ff' : '#4f46e5', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 16 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: showForm ? '#4f46e5' : '#fff' }}>
              {showForm ? '✕ Cancel' : '+ Post New Deal'}
            </Text>
          </TouchableOpacity>

          {/* Post deal form */}
          {showForm && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 }}>New Deal</Text>

              <F label="Title *" field="title" placeholder="e.g. 30% off Samsung S25" />
              <F label="Description *" field="description" placeholder="Describe the deal..." multiline />
              <F label="Offer Price (₹)" field="offer_price" placeholder="e.g. 60000" keyboardType="numeric" />
              <F label="Original Price (₹)" field="original_price" placeholder="e.g. 100000" keyboardType="numeric" />
              <F label="Discount Label" field="discount_label" placeholder="e.g. 40% OFF (or leave blank)" />
              <F label="City" field="city" placeholder="e.g. Bengaluru" />
              <F label="Area" field="area" placeholder="e.g. Koramangala" />
              <F label="Coupon Code" field="coupon_code" placeholder="Optional" />
              <F label="Contact Phone" field="contact_phone" placeholder="10-digit mobile" keyboardType="phone-pad" />
              <F label="Valid Till (YYYY-MM-DD)" field="valid_till_date" placeholder="e.g. 2026-12-31" />

              {/* Category picker */}
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {CATEGORY_OPTIONS.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => setForm((p) => ({ ...p, category: cat.value }))}
                    style={{ marginRight: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: form.category === cat.value ? '#4f46e5' : '#f1f5f9' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: form.category === cat.value ? '#fff' : '#475569' }}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={handlePost}
                disabled={submitting}
                style={{ backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 13, alignItems: 'center', opacity: submitting ? 0.7 : 1 }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{submitting ? 'Posting…' : 'Post Deal'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Deals list */}
          {loading ? (
            <ActivityIndicator color="#4f46e5" />
          ) : deals.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 32 }}>🏷️</Text>
              <Text style={{ marginTop: 8, fontSize: 14, color: '#94a3b8' }}>No deals yet. Post your first deal!</Text>
            </View>
          ) : (
            deals.map((deal) => (
              <View key={deal.id} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#0f172a', marginRight: 8 }} numberOfLines={2}>{deal.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 11, color: deal.status === 'active' ? '#059669' : '#94a3b8', fontWeight: '600' }}>
                      {deal.status === 'active' ? 'Live' : 'Paused'}
                    </Text>
                    <Switch
                      value={deal.status === 'active'}
                      onValueChange={() => toggleStatus(deal)}
                      trackColor={{ false: '#e2e8f0', true: '#a5b4fc' }}
                      thumbColor={deal.status === 'active' ? '#4f46e5' : '#94a3b8'}
                    />
                  </View>
                </View>

                <View style={{ marginTop: 6, flexDirection: 'row', gap: 12 }}>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>👁 {deal.views || 0}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>🖱 {deal.clicks || 0} clicks</Text>
                  {deal.offer_price && <Text style={{ fontSize: 11, color: '#4338ca', fontWeight: '600' }}>₹{deal.offer_price}</Text>}
                </View>

                <TouchableOpacity
                  onPress={() => deleteDeal(deal)}
                  style={{ marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecaca' }}
                >
                  <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '600' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
