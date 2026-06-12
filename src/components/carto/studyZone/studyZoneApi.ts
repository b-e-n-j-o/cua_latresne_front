import type { ParcelleResumeRef } from "../../../types/sigResume";
import type { StudyZoneCartoContext } from "./types";
import { STUDY_ZONE_BUFFER_MAX_DEFAULT, STUDY_ZONE_DISPLAY_CLIP_M } from "./types";

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");
}

export async function fetchStudyZoneCarto(
  communeSlug: string,
  parcelles: ParcelleResumeRef[],
  contextBufferM = STUDY_ZONE_BUFFER_MAX_DEFAULT
): Promise<StudyZoneCartoContext> {
  const res = await fetch(`${apiBase()}/communes/${communeSlug}/parcelles/carto-context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refs: parcelles.map((p) => ({ section: p.section, numero: p.numero })),
      context_buffer_m: contextBufferM,
      display_clip_m: STUDY_ZONE_DISPLAY_CLIP_M,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.detail === "string" ? err.detail : `Carto zone d'étude (${res.status})`
    );
  }
  return res.json();
}
