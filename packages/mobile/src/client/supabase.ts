import { createClient } from "@supabase/supabase-js";

const supabaseUrl: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey: string = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
