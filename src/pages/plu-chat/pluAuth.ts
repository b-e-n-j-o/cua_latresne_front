import supabase from "../../supabaseClient";
import { MAP_BUFFER_M } from "./map/colors";
import type { MapData } from "./map/types";

/** En-têtes Authorization pour les routes PLU (JWT Supabase). */
export async function pluAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** GET /session/{id}/map avec JWT (requis depuis l'isolation user_id). */
export async function fetchPluSessionMap(
  apiRoot: string,
  sessionId: string,
): Promise<Response> {
  const headers = await pluAuthHeaders();
  return fetch(
    `${apiRoot}/session/${sessionId}/map?buffer_m=${MAP_BUFFER_M}`,
    { headers },
  );
}

export function mapDataHasParcelleGeometry(
  parcelle: MapData["parcelle"] | null | undefined,
): boolean {
  if (!parcelle) return false;
  if (parcelle.type === "Feature") return Boolean(parcelle.geometry);
  if (parcelle.type === "FeatureCollection") {
    return parcelle.features.some((f) => f.geometry);
  }
  return false;
}
