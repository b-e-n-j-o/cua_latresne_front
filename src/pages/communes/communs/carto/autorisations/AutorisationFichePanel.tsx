import { Link } from "react-router-dom";
import type { AutFiche } from "./autorisationsApi";
import { AUT_CATEGORIES } from "./autorisationsMap";

const ETAT_COLOR: Record<string, string> = {
  autorisé: "#2a9d8f",
  commencé: "#e9c46a",
  terminé: "#264653",
  annulé: "#9ca3af",
  inconnu: "#6b7280",
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const s = d.slice(0, 10);
  const [y, m, day] = s.split("-");
  if (!day) return s;
  return `${day}/${m}/${y}`;
}

function fmtNum(n: number | null | undefined, suffix = ""): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")}${suffix}`;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="aut-badge"
      style={{ background: color, color: "#fff" }}
    >
      {label}
    </span>
  );
}

function GeolocMention({ fiche, communeSlug }: { fiche: AutFiche; communeSlug: string }) {
  const statut = fiche.geoloc_statut;
  const liens = fiche.parcelles ?? [];
  const orig = liens.find((l) => l.idu_origine && l.idu_origine !== l.idu) ?? liens[0];
  const actuelles = [...new Set(liens.map((l) => l.idu))];
  const nLots = actuelles.length;

  if (statut === "complet_reconstitue") {
    return (
      <p className="aut-geoloc">
        Emprise au moment du dépôt (parcelle {orig?.idu_origine ?? "—"}, cadastre{" "}
        {orig?.millesime_origine ?? "—"}). Parcelle divisée depuis : {actuelles.join(", ") || "—"}.{" "}
        <Link to={`/${communeSlug}/historique`}>Historique &amp; filiation parcellaire</Link>
      </p>
    );
  }
  if (statut === "millesime_operation") {
    return (
      <p className="aut-geoloc">
        Parcelle d&apos;origine découpée en {nLots} lots : opération d&apos;aménagement.
      </p>
    );
  }
  if (statut === "partiel") {
    return (
      <p className="aut-geoloc">
        Certaines parcelles déclarées n&apos;ont pas été retrouvées au cadastre.
      </p>
    );
  }
  return null;
}

export default function AutorisationFichePanel({
  fiche,
  communeSlug,
  onClose,
  onHighlightIdu,
}: {
  fiche: AutFiche;
  communeSlug: string;
  onClose: () => void;
  onHighlightIdu: (idu: string) => void;
}) {
  const cat = AUT_CATEGORIES.find((c) => c.key === fiche.categorie);
  const etat = fiche.etat || "inconnu";

  return (
    <div className="aut-fiche">
      <div className="aut-fiche__head">
        <div>
          <div className="aut-fiche__title">
            {fiche.type_dau ?? "DAU"} {fiche.id}
          </div>
          <div className="aut-fiche__badges">
            {cat ? <Badge label={cat.label} color={cat.color} /> : null}
            <Badge label={etat} color={ETAT_COLOR[etat] ?? "#6b7280"} />
          </div>
        </div>
        <button type="button" className="aut-fiche__close" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </div>

      <ol className="aut-frise">
        <li>
          <span>Dépôt</span>
          <strong>{fmtDate(fiche.date_depot)}</strong>
        </li>
        <li>
          <span>Autorisation</span>
          <strong>{fmtDate(fiche.date_autorisation)}</strong>
        </li>
        <li>
          <span>Ouverture de chantier</span>
          <strong>{fmtDate(fiche.date_doc)}</strong>
        </li>
        <li>
          <span>Achèvement</span>
          <strong>{fmtDate(fiche.date_daact)}</strong>
        </li>
      </ol>

      <dl className="aut-dl">
        <dt>Nature</dt>
        <dd>{fiche.nature_projet || "—"}</dd>
        <dt>Logements</dt>
        <dd>{fmtNum(fiche.nb_logements)}</dd>
        <dt>Surface créée</dt>
        <dd>{fmtNum(fiche.surface_creee, " m²")}</dd>
        <dt>Terrain</dt>
        <dd>{fmtNum(fiche.superficie_terrain, " m²")}</dd>
        <dt>Adresse</dt>
        <dd>{fiche.adresse || "—"}</dd>
        {fiche.siren ? (
          <>
            <dt>Demandeur</dt>
            <dd>
              {fiche.demandeur || "—"}
              <span className="aut-siren">SIREN {fiche.siren}</span>
            </dd>
          </>
        ) : null}
      </dl>

      <div className="aut-parcelles">
        <div className="aut-parcelles__label">Parcelles concernées</div>
        <ul>
          {(fiche.parcelles ?? []).map((p) => (
            <li key={`${p.idu}-${p.methode}`}>
              <button type="button" onClick={() => onHighlightIdu(p.idu)}>
                {p.idu}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <GeolocMention fiche={fiche} communeSlug={communeSlug} />
    </div>
  );
}
