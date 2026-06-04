import supabase from "../../supabaseClient";

/** En-têtes Authorization pour les routes PLU (JWT Supabase). */
export async function pluAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
