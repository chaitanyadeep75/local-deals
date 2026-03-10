import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';

export default function AccountScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleAuth = async () => {
    if (!email || !password) return;
    setLoading(true);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert('Login failed', error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) Alert.alert('Signup failed', error.message);
      else Alert.alert('Check your email', 'We sent you a confirmation link.');
    }
    setLoading(false);
  };

  if (user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 36 }}>👤</Text>
            </View>
            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: '#0f172a' }}>{user.email}</Text>
            <View style={{ marginTop: 4, backgroundColor: '#ecfdf5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#059669' }}>Logged in</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => supabase.auth.signOut()}
            style={{ alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2', paddingVertical: 14 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#dc2626' }}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#4f46e5' }}>LocalDeals</Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: '#64748b' }}>
              {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
            </Text>
          </View>

          <View style={{ backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
              style={{ marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0f172a' }}
            />

            <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              placeholderTextColor="#9ca3af"
              style={{ marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0f172a' }}
            />

            <TouchableOpacity
              onPress={handleAuth}
              disabled={loading}
              style={{ alignItems: 'center', borderRadius: 12, backgroundColor: '#4f46e5', paddingVertical: 12, opacity: loading ? 0.7 : 1 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#64748b' }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={{ fontWeight: '700', color: '#4f46e5' }}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
