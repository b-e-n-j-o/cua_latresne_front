// Supabase client minimal — placez ce fichier dans src/supabaseClient.ts
// Variables requises dans .env :
//   VITE_SUPABASE_URL=
//   VITE_SUPABASE_ANON_KEY=

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn("[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants");
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export default supabase;
