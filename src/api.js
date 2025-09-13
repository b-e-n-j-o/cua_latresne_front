export const API_BASE = '/api'; // grâce au proxy Vercel ci-dessous

export async function getSomething() {
  const r = await fetch(`${API_BASE}/v1/something`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    // credentials: 'include' // seulement si tu utilises des cookies
  });
  if (!r.ok) throw new Error('API error');
  return r.json();
}
