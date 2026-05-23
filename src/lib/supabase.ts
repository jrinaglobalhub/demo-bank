import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// A safe checker to see if Supabase variables are set up
export const isSupabaseConfigured = (): boolean => {
  return (
    typeof window !== 'undefined'
      ? (!!supabaseUrl && !!supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL')
      : (!!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
};

// Singleton browser client for client-side components
export const createBrowserSupabaseClient = () => {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};

// Legacy singleton (used in mock fallback modes or where SSR cookies aren't strictly required)
export const supabase = isSupabaseConfigured()
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : null;
