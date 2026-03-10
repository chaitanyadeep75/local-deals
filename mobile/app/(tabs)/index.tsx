import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { CATEGORY_FILTERS, getCategoryEmoji } from '../../lib/categories';

type Deal = {
  id: number;
  title: string;
  description: string;
  city: string | null;
  area: string | null;
  category: string | null;
  image: string | null;
  image_urls: string[] | null;
  offer_price: string | null;
  original_price: string | null;
  discount_label: string | null;
  valid_till_date: string | null;
  views: number | null;
  rating: number | null;
  rating_count: number | null;
  is_verified: boolean | null;
  created_at: string | null;
  clicks: number | null;
};

function discountPct(deal: Deal): number | null {
  if (deal.discount_label) return null;
  const offer = parseFloat((deal.offer_price || '').replace(/[^\d.]/g, ''));
  const orig = parseFloat((deal.original_price || '').replace(/[^\d.]/g, ''));
  if (orig > offer && offer > 0) return Math.round(((orig - offer) / orig) * 100);
  return null;
}

function DealCard({ deal, onPress }: { deal: Deal; onPress: () => void }) {
  const cover = deal.image_urls?.[0] || deal.image;
  const pct = discountPct(deal);
  const discountText = deal.discount_label || (pct ? `${pct}% OFF` : null);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        marginBottom: 16, borderRadius: 16, backgroundColor: '#fff',
        overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
      }}
    >
      <View style={{ height: 176, backgroundColor: '#f1f5f9' }}>
        {cover ? (
          <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff' }}>
            <Text style={{ fontSize: 40 }}>{getCategoryEmoji(deal.category || '')}</Text>
          </View>
        )}
        {discountText && (
          <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: '#ef4444', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{discountText}</Text>
          </View>
        )}
      </View>

      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a', lineHeight: 20 }} numberOfLines={2}>
            {deal.title}
          </Text>
          {(deal.rating || 0) > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10 }}>⭐</Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#b45309', marginLeft: 2 }}>{(deal.rating || 0).toFixed(1)}</Text>
            </View>
          )}
        </View>

        <Text style={{ marginTop: 4, fontSize: 12, color: '#64748b' }} numberOfLines={2}>{deal.description}</Text>

        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11, color: '#94a3b8' }}>
            📍 {[deal.area, deal.city].filter(Boolean).join(', ') || 'Location'}
          </Text>
          {deal.is_verified && (
            <View style={{ backgroundColor: '#ecfdf5', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#059669' }}>✓ Verified</Text>
            </View>
          )}
        </View>

        {deal.offer_price && (
          <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#4338ca' }}>₹{deal.offer_price}</Text>
            {deal.original_price && (
              <Text style={{ fontSize: 12, color: '#94a3b8', textDecorationLine: 'line-through' }}>₹{deal.original_price}</Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function DealsScreen() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    setErrorMsg(null);
    const { data, error } = await supabase
      .from('deals')
      .select('id,title,description,city,area,category,image,image_urls,offer_price,original_price,discount_label,valid_till_date,views,rating,rating_count,is_verified,created_at,clicks')
      .neq('status', 'paused')
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) setErrorMsg(error.message);
    setDeals((data as Deal[]) || []);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDeals().finally(() => setLoading(false));
  }, [fetchDeals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDeals();
    setRefreshing(false);
  }, [fetchDeals]);

  const filtered = deals.filter((d) => {
    if (category !== 'all' && d.category !== category) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      (d.area || '').toLowerCase().includes(q) ||
      (d.city || '').toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#4f46e5' }}>LocalDeals 🏷️</Text>
        <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Hyperlocal deals near you</Text>
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ fontSize: 14, marginRight: 8 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search deals, areas..."
            placeholderTextColor="#9ca3af"
            style={{ flex: 1, fontSize: 14, color: '#0f172a' }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: '#9ca3af', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', height: 48 }}
        contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center' }}
      >
        {CATEGORY_FILTERS.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            onPress={() => setCategory(cat.value)}
            style={{
              marginRight: 8, flexDirection: 'row', alignItems: 'center',
              borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
              backgroundColor: category === cat.value ? '#4f46e5' : '#f1f5f9',
            }}
          >
            {cat.value !== 'all' && <Text style={{ fontSize: 12, marginRight: 4 }}>{getCategoryEmoji(cat.value)}</Text>}
            <Text style={{ fontSize: 12, fontWeight: '600', color: category === cat.value ? '#fff' : '#475569' }}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {errorMsg && (
        <View style={{ backgroundColor: '#fef2f2', padding: 12, margin: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca' }}>
          <Text style={{ fontSize: 12, color: '#dc2626' }}>Error: {errorMsg}</Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <DealCard deal={item} onPress={() => router.push(`/deal/${item.id}`)} />
          )}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} tintColor="#4f46e5" />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
              <Text style={{ fontSize: 40 }}>🏷️</Text>
              <Text style={{ marginTop: 8, fontSize: 14, color: '#94a3b8' }}>No deals found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
