// Supabase client minimal — placez ce fichier dans src/supabaseClient.ts
// Variables requises dans .env :
//   VITE_SUPABASE_URL=
//   VITE_SUPABASE_ANON_KEY=

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

let supabase: SupabaseClient;

if (url && anon && url.includes("supabase") && anon.length > 20) {
  supabase = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
} else {
  // eslint-disable-next-line no-console
  console.warn("[Supabase] Mode dégradé — credentials manquants");
  supabase = new Proxy({} as SupabaseClient, {
    get: (_target, prop) => {
      if (prop === "auth") {
        return {
          getSession: () => Promise.resolve({ data: { session: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signOut: () => Promise.resolve({ error: null }),
        };
      }
      return () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } });
    },
  });
}

export { supabase };
export default supabase;
