import { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  Linking, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

type Deal = {
  id: number;
  title: string;
  description: string;
  city: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  valid_till_date: string | null;
  views: number;
  clicks: number;
  image: string | null;
  image_urls: string[] | null;
  rating: number | null;
  rating_count: number | null;
  category: string | null;
  offer_price: string | null;
  original_price: string | null;
  discount_label: string | null;
  coupon_code: string | null;
  terms: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  is_verified: boolean | null;
};

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [myRating, setMyRating] = useState(5);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase.from('deals').select('*').eq('id', Number(id)).maybeSingle().then(({ data }) => {
      setDeal(data as Deal | null);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  if (!deal) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', padding: 20 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#4f46e5' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ marginTop: 16, color: '#64748b' }}>Deal not found.</Text>
      </SafeAreaView>
    );
  }

  const images = [...new Set([...(deal.image_urls || []), deal.image || ''].filter(Boolean))];
  const pct = (() => {
    if (deal.discount_label) return null;
    const offer = parseFloat((deal.offer_price || '').replace(/[^\d.]/g, ''));
    const orig = parseFloat((deal.original_price || '').replace(/[^\d.]/g, ''));
    if (orig > offer && offer > 0) return Math.round(((orig - offer) / orig) * 100);
    return null;
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView>
        {/* Image */}
        <View style={{ height: 220, backgroundColor: '#eef2ff' }}>
          {images.length > 0 ? (
            <Image source={{ uri: images[activeImg] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 56 }}>🏷️</Text>
            </View>
          )}
          {(deal.discount_label || pct) && (
            <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: '#ef4444', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{deal.discount_label || `${pct}% OFF`}</Text>
            </View>
          )}
          {images.length > 1 && (
            <View style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{activeImg + 1}/{images.length}</Text>
            </View>
          )}
        </View>

        <View style={{ padding: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#4f46e5' }}>← Back to deals</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a', lineHeight: 28 }}>{deal.title}</Text>

          <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {deal.is_verified && (
              <View style={{ backgroundColor: '#ecfdf5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#059669' }}>✓ Verified</Text>
              </View>
            )}
            {deal.category && (
              <View style={{ backgroundColor: '#f5f3ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#7c3aed', textTransform: 'capitalize' }}>{deal.category}</Text>
              </View>
            )}
          </View>

          <Text style={{ marginTop: 12, fontSize: 14, color: '#475569', lineHeight: 22 }}>{deal.description}</Text>

          {(deal.offer_price || deal.original_price) && (
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {deal.offer_price && <Text style={{ fontSize: 20, fontWeight: '700', color: '#4338ca' }}>₹{deal.offer_price}</Text>}
              {deal.original_price && <Text style={{ fontSize: 14, color: '#94a3b8', textDecorationLine: 'line-through' }}>₹{deal.original_price}</Text>}
            </View>
          )}

          {deal.coupon_code && (
            <TouchableOpacity
              onPress={() => Alert.alert('Coupon Code', deal.coupon_code!)}
              style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#a5b4fc', backgroundColor: '#eef2ff', paddingHorizontal: 12, paddingVertical: 10 }}
            >
              <Text style={{ fontSize: 16 }}>🎟️</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#4338ca' }}>{deal.coupon_code}</Text>
              <Text style={{ marginLeft: 'auto', fontSize: 12, color: '#6366f1' }}>Tap to copy</Text>
            </TouchableOpacity>
          )}

          <View style={{ marginTop: 16, gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#64748b' }}>📍 {[deal.area, deal.city].filter(Boolean).join(', ') || 'Location not set'}</Text>
            <Text style={{ fontSize: 12, color: '#64748b' }}>👁 {deal.views || 0} views · ⭐ {deal.rating?.toFixed(1) || '0.0'} ({deal.rating_count || 0} reviews)</Text>
            {deal.valid_till_date && (
              <Text style={{ fontSize: 12, color: '#64748b' }}>⏰ Valid till {new Date(deal.valid_till_date).toLocaleDateString('en-IN')}</Text>
            )}
          </View>

          {deal.terms && (
            <View style={{ marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', padding: 12 }}>
              <Text style={{ fontSize: 12, color: '#64748b' }}>📋 {deal.terms}</Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={{ marginTop: 20, gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                if (!deal.latitude || !deal.longitude) return;
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`);
              }}
              disabled={!deal.latitude || !deal.longitude}
              style={{ alignItems: 'center', borderRadius: 16, backgroundColor: '#4f46e5', paddingVertical: 14, opacity: (!deal.latitude || !deal.longitude) ? 0.5 : 1 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>🧭 Get Directions</Text>
            </TouchableOpacity>

            {deal.contact_whatsapp && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`https://wa.me/${deal.contact_whatsapp!.replace(/\D/g, '')}`)}
                style={{ alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', paddingVertical: 14 }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#16a34a' }}>💬 WhatsApp</Text>
              </TouchableOpacity>
            )}

            {deal.contact_phone && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${deal.contact_phone}`)}
                style={{ alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', paddingVertical: 14 }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#334155' }}>📞 Call</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick rating */}
          <View style={{ marginTop: 24, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 10 }}>Rate this deal</Text>
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 12 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setMyRating(s)}>
                  <Text style={{ fontSize: 32, color: s <= myRating ? '#facc15' : '#e2e8f0' }}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={async () => {
                if (!userId) { Alert.alert('Sign in required', 'Please sign in to leave a review.'); return; }
                const { data: existing } = await supabase.from('reviews').select('id').eq('deal_id', Number(id)).eq('user_id', userId).maybeSingle();
                if (existing?.id) {
                  await supabase.from('reviews').update({ rating: myRating }).eq('id', existing.id);
                } else {
                  await supabase.from('reviews').insert({ deal_id: Number(id), user_id: userId, rating: myRating });
                }
                Alert.alert('Thanks!', 'Your review has been saved.');
              }}
              style={{ alignItems: 'center', borderRadius: 12, backgroundColor: '#4f46e5', paddingVertical: 10 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Submit review</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
