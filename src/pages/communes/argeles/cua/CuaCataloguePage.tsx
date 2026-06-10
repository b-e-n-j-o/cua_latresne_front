import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import "./CuaCataloguePage.css";

const API = import.meta.env.VITE_API_BASE || "";

type CatalogueLayer = {
  nom: string;
  type: string;
  keep: string[];
  origine: string;
  article?: string;
  geom_type: string;
  group_by?: string[];
  geom_col?: string;
};

type Catalogue = Record<string, CatalogueLayer>;

const COMMUNES_WITH_CATALOGUE = new Set(["argeles"]);

const TYPE_LABELS: Record<string, string> = {
  prescription: "Prescription",
  information: "Information",
  servitude: "Servitude",
  reseaux: "Réseaux",
};

const GEOM_LABELS: Record<string, string> = {
  surfacique: "Surfacique",
  lineaire: "Linéaire",
  ponctuel: "Ponctuel",
};

export default function CuaCataloguePage() {
  const { communeSlug } = useParams<{ communeSlug: string }>();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!communeSlug || !COMMUNES_WITH_CATALOGUE.has(communeSlug)) {
      setLoading(false);
      setError("Catalogue non disponible pour cette commune.");
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`${API}/communes/${communeSlug}/cua/catalogue`)
      .then((res) => {
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return res.json();
      })
      .then((data: Catalogue) => setCatalogue(data))
      .catch(() => setError("Impossible de charger le catalogue."))
      .finally(() => setLoading(false));
  }, [communeSlug]);

  const layers = useMemo(() => {
    if (!catalogue) return [];
    return Object.entries(catalogue)
      .map(([table, cfg]) => ({ table, ...cfg }))
      .sort((a, b) => {
        const artA = a.article ? Number(a.article) : Number.POSITIVE_INFINITY;
        const artB = b.article ? Number(b.article) : Number.POSITIVE_INFINITY;
        if (artA !== artB) return artA - artB;
        return a.nom.localeCompare(b.nom, "fr");
      });
  }, [catalogue]);

  if (loading) {
    return <div className="cua-catalogue cua-catalogue--state">Chargement du catalogue…</div>;
  }

  if (error || !catalogue) {
    return (
      <div className="cua-catalogue cua-catalogue--state">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="cua-catalogue">
      <header className="cua-catalogue__header">
        <p className="cua-catalogue__eyebrow">Référentiel couches SIG</p>
        <h1>Catalogue CUA — Argelès-sur-Mer</h1>
        <p className="cua-catalogue__intro">
          {layers.length} couches utilisées pour les intersections avec l’unité foncière.
        </p>
      </header>

      <ul className="cua-catalogue__list">
        {layers.map((layer) => (
          <li key={layer.table}>
            <article className="cua-catalogue__card">
              <div className="cua-catalogue__card-article">
                {layer.article ? (
                  <span className="cua-catalogue__article">Art. {layer.article}</span>
                ) : (
                  <span className="cua-catalogue__article cua-catalogue__article--none">—</span>
                )}
              </div>

              <div className="cua-catalogue__card-main">
                <h3>{layer.nom}</h3>
                <code className="cua-catalogue__table">{layer.table}</code>
              </div>

              <div className="cua-catalogue__card-badges">
                <span className="cua-catalogue__badge">{TYPE_LABELS[layer.type] ?? layer.type}</span>
                <span className="cua-catalogue__badge cua-catalogue__badge--muted">
                  {GEOM_LABELS[layer.geom_type] ?? layer.geom_type}
                </span>
                <span className="cua-catalogue__badge cua-catalogue__badge--muted">{layer.origine}</span>
              </div>

              <dl className="cua-catalogue__card-meta">
                <div>
                  <dt>Attributs conservés</dt>
                  <dd>
                    <ul className="cua-catalogue__tags">
                      {layer.keep.map((field) => (
                        <li key={field}>{field}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
                {(layer.group_by?.length ?? 0) > 0 && (
                  <div>
                    <dt>Regroupement</dt>
                    <dd>{layer.group_by!.join(", ")}</dd>
                  </div>
                )}
                {layer.geom_col && (
                  <div>
                    <dt>Colonne géométrie</dt>
                    <dd>{layer.geom_col}</dd>
                  </div>
                )}
              </dl>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
