import supabase from "../supabaseClient";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

/** Fetch API backend avec Bearer token Supabase (session courante). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...init, headers });
}
