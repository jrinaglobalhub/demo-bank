"use client";

import { createBrowserClient } from '@supabase/ssr';

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

// 🛠️ FIX: TypeScript ബിൽഡ് എറർ ഒഴിവാക്കാൻ 'as any' അല്ലെങ്കിൽ ടൈപ്പ് കാസ്റ്റിംഗ് നൽകുന്നു
export const supabase = isSupabaseConfigured()
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : (null as any);