import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://leleedkossyoourxqyml.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_jg43TcBmYvrJxTklL8F3Hw_lESfk3wU";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseKey as string, {
      auth: {
        persistSession: false,
      },
    })
  : null;
