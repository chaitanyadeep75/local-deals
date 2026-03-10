import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wfnbdnmbliqjaxscfchw.supabase.co';
const supabaseAnonKey = 'sb_publishable_stUic5UWOoEmnTqjZhfUiw_nNQY07aR';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
