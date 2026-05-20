import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { CATEGORY_OPTIONS } from '../../lib/categories';

const PHONE_RE = /^[6-9]\d{9}$/;

const EMPTY = {
  email: '', password: '',
  businessName: '', ownerName: '', phone: '', city: '', category: '', description: '',
  gstin: '', website: '', instagram: '',
};

function Field({ label, value, onChange, placeholder, secureTextEntry, keyboardType, multiline, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
  multiline?: boolean; maxLength?: number;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        maxLength={maxLength}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        style={{
          borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
          paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a',
          minHeight: multiline ? 90 : undefined, textAlignVertical: multiline ? 'top' : undefined,
        }}
      />
    </View>
  );
}

export default function BusinessSignup() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key: keyof typeof EMPTY) => (v: string) => setForm((p) => ({ ...p, [key]: v }));

  const validate = () => {
    if (step === 1) {
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) {
        Alert.alert('Error', 'Enter a valid email'); return false;
      }
      if (form.password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters'); return false;
      }
    }
    if (step === 2) {
      if (form.businessName.trim().length < 3) {
        Alert.alert('Error', 'Business name must be at least 3 characters'); return false;
      }
      if (form.ownerName.trim().length < 2) {
        Alert.alert('Error', 'Owner name is required'); return false;
      }
      if (!PHONE_RE.test(form.phone.trim())) {
        Alert.alert('Error', 'Enter a valid 10-digit Indian mobile number'); return false;
      }
      if (!form.city.trim()) {
        Alert.alert('Error', 'City is required'); return false;
      }
      if (!form.category) {
        Alert.alert('Error', 'Select a business category'); return false;
      }
      if (form.description.trim().length < 50) {
        Alert.alert('Error', `Description must be at least 50 characters (${form.description.trim().length}/50)`); return false;
      }
    }
    return true;
  };

  const next = () => { if (validate()) setStep((s) => (s < 3 ? (s + 1) as 1|2|3 : s)); };
  const back = () => setStep((s) => (s > 1 ? (s - 1) as 1|2|3 : s));

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          role: 'business',
          business_profile: {
            shop_name:  form.businessName.trim(),
            owner_name: form.ownerName.trim(),
            phone:      form.phone.trim(),
            city:       form.city.trim(),
            category:   form.category,
            about:      form.description.trim(),
            gstin:      form.gstin.trim().toUpperCase() || null,
            website:    form.website.trim() || null,
            instagram:  form.instagram.trim() || null,
          },
        },
      },
    });

    if (error) { Alert.alert('Error', error.message); setLoading(false); return; }

    if (data.user?.id) {
      await supabase.from('business_permissions').upsert({
        user_id: data.user.id,
        status: 'approved',
        reason: null,
      });
    }

    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 48 }}>✅</Text>
        <Text style={{ marginTop: 16, fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>You're registered!</Text>
        <Text style={{ marginTop: 8, fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 }}>
          Please verify your email. Business posting access will be enabled after approval — usually within 24 hours.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/account')}
          style={{ marginTop: 24, backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Go to Login</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const stepLabels = ['Account', 'Business', 'Extras'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 10 }}>
          <Text style={{ color: '#c7d2fe', fontSize: 13 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' }}>Business Signup</Text>
        <Text style={{ fontSize: 12, color: '#c7d2fe', textAlign: 'center', marginTop: 2 }}>Start listing your deals today</Text>

        {/* Step indicators */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 8 }}>
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: done ? '#10b981' : active ? '#fff' : 'rgba(255,255,255,0.25)',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: done ? '#fff' : active ? '#4f46e5' : '#fff' }}>
                    {done ? '✓' : n}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '600', color: active ? '#fff' : '#c7d2fe' }}>{label}</Text>
                {i < 2 && <Text style={{ color: '#c7d2fe' }}>›</Text>}
              </View>
            );
          })}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

          {/* Step 1 */}
          {step === 1 && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 16 }}>Account Credentials</Text>
              <Field label="Business Email *" value={form.email} onChange={set('email')} placeholder="business@email.com" keyboardType="email-address" />
              <Field label="Password *" value={form.password} onChange={set('password')} placeholder="Minimum 6 characters" secureTextEntry />
            </View>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 16 }}>Business Information</Text>
              <Field label="Business Name *" value={form.businessName} onChange={set('businessName')} placeholder="e.g. Sharma Electronics" />
              <Field label="Owner / Contact Name *" value={form.ownerName} onChange={set('ownerName')} placeholder="e.g. Ravi Sharma" />
              <Field label="Phone Number * (+91)" value={form.phone} onChange={(v) => set('phone')(v.replace(/\D/g, ''))} placeholder="10-digit mobile number" keyboardType="phone-pad" maxLength={10} />
              <Field label="City *" value={form.city} onChange={set('city')} placeholder="e.g. Bengaluru" />

              <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 }}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {CATEGORY_OPTIONS.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => set('category')(cat.value)}
                    style={{ marginRight: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: form.category === cat.value ? '#4f46e5' : '#f1f5f9' }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: form.category === cat.value ? '#fff' : '#475569' }}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Field
                label={`About your business * (${form.description.trim().length}/50 min)`}
                value={form.description}
                onChange={set('description')}
                placeholder="Tell customers what you offer, your specialty, timings, etc."
                multiline
              />
            </View>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 }}>Optional Extras</Text>
              <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>All fields on this step are optional.</Text>
              <Field label="GSTIN" value={form.gstin} onChange={(v) => set('gstin')(v.toUpperCase())} placeholder="29ABCDE1234F1Z5" maxLength={15} />
              <Field label="Website" value={form.website} onChange={set('website')} placeholder="https://yourbusiness.com" keyboardType="url" />
              <Field label="Instagram Handle (@)" value={form.instagram} onChange={(v) => set('instagram')(v.replace('@', ''))} placeholder="yourbusiness" />
            </View>
          )}

          {/* Navigation */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            {step > 1 && (
              <TouchableOpacity
                onPress={back}
                style={{ paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#475569' }}>← Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={step < 3 ? next : handleSubmit}
              disabled={loading}
              style={{ flex: 1, backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: loading ? 0.7 : 1 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                {loading ? 'Creating account…' : step < 3 ? 'Next →' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
