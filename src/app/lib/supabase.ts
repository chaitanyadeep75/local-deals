import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables are missing');
}

// Use an app-level lock to avoid intermittent AbortError from browser LockManager
// in dev/HMR (Turbopack) when auth calls race during re-renders.
const authLock = async <T>(_: string, __: number, fn: () => Promise<T>) => fn();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: authLock,
  },
});
