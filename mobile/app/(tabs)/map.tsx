import { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  TextInput, ScrollView,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { CATEGORY_OPTIONS, getCategoryEmoji } from '../../lib/categories';

type Deal = {
  id: number;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  area: string | null;
  city: string | null;
  category: string | null;
  offer_price: string | null;
  original_price: string | null;
  discount_label: string | null;
  rating: number | null;
  is_verified: boolean | null;
};

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    const fetchDeals = async () => {
      const { data } = await supabase
        .from('deals')
        .select('id,title,description,latitude,longitude,area,city,category,offer_price,original_price,discount_label,rating,is_verified')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .neq('status', 'paused');
      setDeals((data as Deal[]) || []);
      setLoading(false);
    };
    fetchDeals();
  }, []);

  const filtered = deals.filter((d) => {
    if (category !== 'all' && d.category !== category) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      (d.area || '').toLowerCase().includes(q) ||
      (d.city || '').toLowerCase().includes(q)
    );
  });

  const discountText = (deal: Deal) => {
    if (deal.discount_label) return deal.discount_label;
    const offer = parseFloat((deal.offer_price || '').replace(/[^\d.]/g, ''));
    const orig = parseFloat((deal.original_price || '').replace(/[^\d.]/g, ''));
    if (orig > offer && offer > 0) return `${Math.round(((orig - offer) / orig) * 100)}% OFF`;
    return null;
  };

  const handleMyLocation = () => {
    navigator?.geolocation?.getCurrentPosition(
      (pos) => {
        mapRef.current?.animateToRegion({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 800);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['top']}>
      {/* Search + filters */}
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }}>
          <Text style={{ marginRight: 8 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search on map..."
            placeholderTextColor="#9ca3af"
            style={{ flex: 1, fontSize: 13, color: '#0f172a' }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: '#9ca3af' }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 36 }} contentContainerStyle={{ alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setCategory('all')}
            style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: category === 'all' ? '#4f46e5' : '#f1f5f9', marginRight: 6 }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: category === 'all' ? '#fff' : '#475569' }}>All</Text>
          </TouchableOpacity>
          {CATEGORY_OPTIONS.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              onPress={() => setCategory(cat.value)}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: category === cat.value ? '#4f46e5' : '#f1f5f9', marginRight: 6, flexDirection: 'row', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 11, marginRight: 3 }}>{getCategoryEmoji(cat.value)}</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: category === cat.value ? '#fff' : '#475569' }}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>Loading map...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={{ latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
          >
            {filtered.map((deal) => (
              <Marker
                key={deal.id}
                coordinate={{ latitude: deal.latitude, longitude: deal.longitude }}
                pinColor={deal.is_verified ? '#10b981' : '#6366f1'}
              >
                <Callout tooltip onPress={() => router.push(`/deal/${deal.id}`)}>
                  <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, width: 210, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }} numberOfLines={2}>{deal.title}</Text>
                    {deal.is_verified && <Text style={{ fontSize: 10, color: '#059669', marginTop: 2 }}>✓ Verified</Text>}
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 3 }} numberOfLines={1}>
                      📍 {[deal.area, deal.city].filter(Boolean).join(', ') || 'Location'}
                    </Text>
                    {discountText(deal) && (
                      <View style={{ marginTop: 4, alignSelf: 'flex-start', backgroundColor: '#ef4444', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{discountText(deal)}</Text>
                      </View>
                    )}
                    {(deal.rating || 0) > 0 && (
                      <Text style={{ fontSize: 11, color: '#b45309', marginTop: 3 }}>⭐ {(deal.rating || 0).toFixed(1)}</Text>
                    )}
                    <View style={{ marginTop: 8, backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 6, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>View Deal →</Text>
                    </View>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
        )}

        {/* My location button */}
        <TouchableOpacity
          onPress={handleMyLocation}
          style={{ position: 'absolute', bottom: 16, right: 12, backgroundColor: '#fff', borderRadius: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}
        >
          <Text style={{ fontSize: 20 }}>📍</Text>
        </TouchableOpacity>

        {/* Deals count */}
        <View style={{ position: 'absolute', bottom: 16, left: 12, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>{filtered.length} deals on map</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
