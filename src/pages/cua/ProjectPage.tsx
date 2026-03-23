import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import LogoutButton from "../../auth/LogoutButton";
import supabase from "../../supabaseClient";
import type { HistoryPipeline } from "../../components/tools/carto/HistoryPipelineCard";

type ProjectFile = {
  id: string;
  file_kind: string;
  filename: string;
  mime_type?: string;
  size_bytes?: number;
  public_url?: string;
  storage_bucket?: string;
  storage_path?: string;
  source?: string;
  created_at?: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

function formatDate(value?: string): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("fr-FR");
  } catch {
    return value;
  }
}

function formatAdresse(adr?: HistoryPipeline["cerfa_data"] extends infer T
  ? T extends { adresse_terrain?: infer A }
    ? A
    : never
  : never): string {
  if (!adr) return "—";
  const parts = [adr.numero, adr.voie, adr.lieu_dit, adr.code_postal, adr.ville].filter(Boolean);
  return parts.join(", ") || "—";
}

function getExpirationProgress(createdAt?: string): { progress: number; isExpired: boolean } | null {
  if (!createdAt) return null;
  try {
    const created = new Date(createdAt);
    const expiry = new Date(created);
    expiry.setMonth(expiry.getMonth() + 18);
    const now = new Date();
    if (now <= created) return { progress: 0, isExpired: false };
    if (now >= expiry) return { progress: 100, isExpired: true };
    const total = expiry.getTime() - created.getTime();
    const elapsed = now.getTime() - created.getTime();
    return { progress: (elapsed / total) * 100, isExpired: false };
  } catch {
    return null;
  }
}

function encodeViewerToken(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bucketFromPublicUrl(url?: string): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  const rest = url.slice(idx + marker.length);
  const bucket = rest.split("/")[0];
  return bucket || null;
}

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [project, setProject] = useState<HistoryPipeline | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [fileKind, setFileKind] = useState<"cerfa_pdf" | "attachment">("cerfa_pdf");
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"documents" | "cartography">("documents");
  const [mapSelected, setMapSelected] = useState<"2d" | "3d">("2d");
  const [mapIframeSrc, setMapIframeSrc] = useState<string>("");
  const [mapLoading, setMapLoading] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const projectLink = useMemo(() => {
    if (!project) return null;
    return project.qr_url || project.output_cua || null;
  }, [project]);
  const expiration = useMemo(() => getExpirationProgress(project?.created_at), [project?.created_at]);

  const map2dUrl = useMemo(() => {
    const p: any = project;
    return p?.carte_2d_url || p?.metadata?.carte_2d_url || "";
  }, [project]);

  const map3dUrl = useMemo(() => {
    const p: any = project;
    return p?.carte_3d_url || p?.metadata?.carte_3d_url || "";
  }, [project]);

  const cuaDocxFile = useMemo(() => {
    return (
      files.find((f) => f.file_kind === "cua_docx" && (f.storage_path || f.public_url)) ||
      files.find(
        (f) =>
          (f.mime_type || "").includes(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ) && (f.storage_path || f.public_url),
      ) ||
      null
    );
  }, [files]);

  const openCuaViewer = (file: ProjectFile) => {
    const parsedBucket = bucketFromPublicUrl(file.public_url);
    const token = encodeViewerToken({
      bucket: parsedBucket || file.storage_bucket || "project-directories",
      // On privilégie l'URL publique complète pour éviter les ambiguïtés bucket/path.
      docx: file.public_url || file.storage_path || "",
      file_id: file.id,
      slug,
    });
    window.open(`/cua?t=${encodeURIComponent(token)}`, "_blank", "noopener,noreferrer");
  };

  const loadAll = async () => {
    if (!slug) return;
    setIsLoading(true);
    setError(null);
    try {
      const [projectRes, filesRes] = await Promise.all([
        fetch(`${API_BASE}/pipelines/by_slug?slug=${encodeURIComponent(slug)}`),
        fetch(`${API_BASE}/pipelines/${encodeURIComponent(slug)}/files`),
      ]);

      const projectJson = await projectRes.json();
      const filesJson = await filesRes.json();

      if (!projectRes.ok || !projectJson?.success) {
        throw new Error(projectJson?.error || "Impossible de charger le projet");
      }
      setProject(projectJson.pipeline || null);
      setFiles(Array.isArray(filesJson?.files) ? filesJson.files : []);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const user = sess.session?.user;
        if (user) setUserEmail(user.email || null);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    loadAll();
  }, [slug]);

  useEffect(() => {
    if (map2dUrl) setMapSelected("2d");
    else if (map3dUrl) setMapSelected("3d");
  }, [map2dUrl, map3dUrl]);

  useEffect(() => {
    if (activeTab !== "cartography") return;
    const targetUrl = mapSelected === "2d" ? map2dUrl : map3dUrl;
    if (!targetUrl) {
      setMapError("Aucune URL de carte disponible pour ce projet.");
      setMapIframeSrc("");
      return;
    }

    let blobUrl: string | null = null;
    let cancelled = false;

    async function loadMap() {
      setMapLoading(true);
      setMapError(null);
      try {
        const res = await fetch(targetUrl);
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const html = await res.text();
        if (cancelled) return;
        const blob = new Blob([html], { type: "text/html" });
        blobUrl = URL.createObjectURL(blob);
        setMapIframeSrc(blobUrl);
      } catch (e: any) {
        if (cancelled) return;
        setMapError(e?.message || "Erreur de chargement de la cartographie.");
        setMapIframeSrc("");
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    }

    loadMap();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [activeTab, mapSelected, map2dUrl, map3dUrl]);

  const onUpload = async (file: File, fileKind: string) => {
    if (!slug) return;
    setIsUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("file_kind", fileKind);
      const res = await fetch(`${API_BASE}/pipelines/${encodeURIComponent(slug)}/files/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Erreur d'upload");
      }
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Erreur d'upload");
    } finally {
      setIsUploading(false);
    }
  };

  const onDeleteFile = async (fileId: string) => {
    if (!slug) return;
    const ok = window.confirm("Supprimer ce fichier ?");
    if (!ok) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/pipelines/${encodeURIComponent(slug)}/files/${fileId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Erreur suppression fichier");
      }
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Erreur suppression fichier");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-[#0b131f]">
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto h-full px-6 flex items-center justify-between">
          <img src="/logo_kerelia_noir.png" className="h-7" alt="Kerelia" />
          <div className="flex items-center gap-4">
            {userEmail && (
              <div className="text-xs text-[#0b131f]/60">
                <div className="font-medium">{userEmail}</div>
              </div>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="pt-20 max-w-6xl mx-auto px-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">Dossier projet</h1>
            <p className="text-sm text-gray-500">Slug : {slug}</p>
          </div>
          <Link to="/latresne/cua" className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-white">
            Retour cartographie
          </Link>
        </div>

        <div className="mb-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("documents")}
              className={`px-3 py-2 text-sm rounded-t border ${
                activeTab === "documents"
                  ? "bg-white border-gray-300 border-b-white font-medium text-teal-700"
                  : "bg-gray-100 border-transparent text-gray-600 hover:text-gray-800"
              }`}
            >
              Documents projet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cartography")}
              className={`px-3 py-2 text-sm rounded-t border ${
                activeTab === "cartography"
                  ? "bg-white border-gray-300 border-b-white font-medium text-teal-700"
                  : "bg-gray-100 border-transparent text-gray-600 hover:text-gray-800"
              }`}
            >
              Cartographie projet
            </button>
          </div>
        </div>

        {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>}

        {isLoading ? (
          <div className="text-sm text-gray-500">Chargement...</div>
        ) : activeTab === "documents" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="font-medium mb-3">Informations du projet</h2>
              {project ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs font-medium text-gray-500">Date de génération</span>
                    <div className="text-gray-800">{formatDate(project.created_at)}</div>
                  </div>

                  {expiration && (
                    <div className="rounded border border-teal-200 bg-teal-50 p-3">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span className="font-medium">Validité 18 mois</span>
                        <span className={expiration.isExpired ? "text-red-700 font-medium" : "text-teal-700 font-medium"}>
                          {expiration.isExpired ? "Expiré" : `${Math.round(100 - expiration.progress)}% restant`}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-teal-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            expiration.isExpired ? "bg-red-500" : expiration.progress > 80 ? "bg-amber-500" : "bg-teal-500"
                          }`}
                          style={{ width: `${Math.min(100, expiration.progress)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-medium text-gray-500">N° CU</span>
                    <div className="font-mono text-gray-800">{project.cerfa_data?.numero_cu || "—"}</div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-gray-500">Demandeur</span>
                    <div className="text-gray-800">{project.cerfa_data?.demandeur || "—"}</div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-gray-500">Date de dépôt</span>
                    <div className="text-gray-800">{formatDate(project.cerfa_data?.date_depot)}</div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-gray-500">Commune</span>
                    <div className="text-gray-800">{project.cerfa_data?.commune_nom || project.commune || "—"}</div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-gray-500">Adresse du terrain</span>
                    <div className="text-gray-800">{formatAdresse(project.cerfa_data?.adresse_terrain)}</div>
                  </div>

                  {project.cerfa_data?.parcelles && project.cerfa_data.parcelles.length > 0 && (
                    <div className="rounded border border-teal-200 bg-teal-50 p-2">
                      <span className="text-xs font-medium text-teal-800">
                        Parcelles ({project.cerfa_data.parcelles.length})
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {project.cerfa_data.parcelles.map((p, i) => (
                          <span key={i} className="inline-flex items-center rounded bg-teal-100 px-2 py-0.5 text-xs text-teal-800">
                            {p.section} {p.numero}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {typeof project.cerfa_data?.superficie === "number" && (
                    <div>
                      <span className="text-xs font-medium text-gray-500">Superficie</span>
                      <div className="text-gray-800">
                        {project.cerfa_data.superficie.toLocaleString("fr-FR", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}{" "}
                        m²
                      </div>
                    </div>
                  )}

                  {projectLink && (
                    <a
                      href={projectLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex mt-2 text-sm px-3 py-2 rounded bg-teal-600 hover:bg-teal-700 text-white transition-colors"
                    >
                      Voir les cartes de zonage 2D et de terrain 3D
                    </a>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Projet introuvable.</div>
              )}
            </section>

            <section className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="font-medium mb-3">Ajouter un fichier</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600">Type de fichier</label>
                  <select
                    value={fileKind}
                    onChange={(e) => setFileKind(e.target.value as "cerfa_pdf" | "attachment")}
                    className="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5"
                    disabled={isUploading}
                  >
                    <option value="cerfa_pdf">PDF CERFA</option>
                    <option value="attachment">Pièce jointe</option>
                  </select>
                </div>

                <label
                  className={`relative block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition ${
                    isDragOver
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-300 hover:border-teal-400 hover:bg-gray-50"
                  } ${isUploading ? "opacity-60 cursor-not-allowed" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isUploading) setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (isUploading) return;
                    const f = e.dataTransfer.files?.[0];
                    if (f) onUpload(f, fileKind);
                  }}
                >
                  <input
                    type="file"
                    className="sr-only"
                    disabled={isUploading}
                    accept={fileKind === "cerfa_pdf" ? ".pdf,application/pdf" : undefined}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUpload(f, fileKind);
                      e.currentTarget.value = "";
                    }}
                  />
                  <UploadCloud className="w-6 h-6 mx-auto text-teal-600 mb-2" />
                  <p className="text-sm font-medium text-gray-700">
                    Déposez un fichier ici
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ou cliquez pour sélectionner depuis votre ordinateur
                  </p>
                </label>
              </div>
            </section>

            <section className="lg:col-span-3 bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="font-medium mb-3">Fichiers du dossier</h2>
              {cuaDocxFile && (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => openCuaViewer(cuaDocxFile)}
                    className="inline-flex text-sm px-3 py-2 rounded bg-teal-600 hover:bg-teal-700 text-white transition-colors"
                  >
                    Ouvrir le CUA (visualiser / éditer)
                  </button>
                </div>
              )}
              {files.length === 0 ? (
                <div className="text-sm text-gray-500">Aucun fichier dans ce dossier.</div>
              ) : (
                <div className="space-y-2">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center justify-between border border-gray-200 rounded p-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{f.filename}</div>
                        <div className="text-xs text-gray-500">
                          {f.file_kind} • {f.mime_type || "—"} • {typeof f.size_bytes === "number" ? `${Math.round(f.size_bytes / 1024)} Ko` : "—"} • {formatDate(f.created_at)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {f.file_kind === "cua_docx" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openCuaViewer(f)}
                              className="text-xs px-2 py-1 rounded border border-teal-300 text-teal-700 hover:bg-teal-50"
                            >
                              CUA
                            </button>
                            {f.public_url && (
                              <a
                                href={f.public_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                              >
                                Télécharger
                              </a>
                            )}
                          </>
                        ) : (
                          f.public_url && (
                            <a
                              href={f.public_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                            >
                              Ouvrir
                            </a>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteFile(f.id)}
                          className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Cartographie du projet</h2>
              <div className="flex items-center gap-2">
                <label htmlFor="mapSelectorProject" className="text-sm text-gray-600">
                  Vue :
                </label>
                <select
                  id="mapSelectorProject"
                  value={mapSelected}
                  onChange={(e) => setMapSelected(e.target.value as "2d" | "3d")}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5"
                >
                  <option value="2d" disabled={!map2dUrl}>
                    Vue 2D
                  </option>
                  <option value="3d" disabled={!map3dUrl}>
                    Vue 3D
                  </option>
                </select>
              </div>
            </div>

            {projectLink && (
              <div className="mb-3">
                <a
                  href={projectLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-sm px-3 py-2 rounded bg-teal-600 hover:bg-teal-700 text-white transition-colors"
                >
                  Ouvrir la cartographie en page dédiée
                </a>
              </div>
            )}

            <div className="relative h-[70vh] rounded border border-gray-200 overflow-hidden bg-gray-50">
              {mapLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-600 bg-white/70">
                  Chargement de la carte...
                </div>
              )}
              {mapError ? (
                <div className="h-full flex items-center justify-center text-sm text-red-700 px-4 text-center">
                  {mapError}
                </div>
              ) : mapIframeSrc ? (
                <iframe
                  key={mapSelected}
                  src={mapIframeSrc}
                  sandbox="allow-scripts allow-same-origin"
                  style={{ width: "100%", height: "100%", border: "none", background: "white" }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-500 px-4 text-center">
                  Aucune carte disponible pour ce projet.
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

