import { useEffect, useState } from "react";
import { FileText, MapPin } from "lucide-react";
import { autorisationsApi, type AutFiche } from "../autorisations/autorisationsApi";
import { AUT_CATEGORIES } from "../autorisations/autorisationsMap";

export type AutorisationUrbanismeItem = {
  id: string;
  categorie: string;
  type_dau: string | null;
  etat: string;
  date: string | null;
  adresse: string | null;
  parcelles: string | null;
  localisee: boolean;
};

type Props = {
  item: AutorisationUrbanismeItem;
  communeSlug: string;
  expanded: boolean;
};

function labelCategorie(key: string): string {
  return AUT_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Date inconnue";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AutorisationUrbanismeCard({ item, communeSlug, expanded }: Props) {
  const [fiche, setFiche] = useState<AutFiche | null>(null);

  useEffect(() => {
    if (!expanded) return;
    let alive = true;
    autorisationsApi
      .fiche(communeSlug, item.id)
      .then((data) => {
        if (alive) setFiche(data);
      })
      .catch(() => {
        if (alive) setFiche(null);
      });
    return () => {
      alive = false;
    };
  }, [expanded, communeSlug, item.id]);

  return (
    <div className="w-full text-left px-3 py-2">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#0b131f]/40" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-black">
            {item.type_dau || labelCategorie(item.categorie)} · {item.id}
          </div>
          <div className="mt-0.5 text-xs text-[#0b131f]/60">{formatDate(item.date)}</div>
          <div className="mt-0.5 truncate text-xs text-[#0b131f]/50">
            {item.adresse || "Adresse non renseignée"}
            {item.localisee ? "" : " · non cartographiée"}
          </div>
          <div className="mt-0.5 text-xs text-[#0b131f]/40">{item.etat}</div>
        </div>
      </div>

      {expanded && fiche ? (
        <div className="mt-2 space-y-1 border-t border-[#d5e1e3] pt-2 text-xs text-[#0b131f]/80">
          {fiche.demandeur ? <div>Demandeur : {fiche.demandeur}</div> : null}
          {fiche.nature_projet ? <div>{fiche.nature_projet}</div> : null}
          {fiche.parcelles?.length ? (
            <div className="flex flex-wrap items-center gap-1">
              <MapPin size={12} className="text-teal-700" />
              {fiche.parcelles.map((p) => (
                <span key={p.idu} className="rounded bg-teal-50 px-1.5 py-0.5 text-teal-800">
                  {p.idu}
                </span>
              ))}
            </div>
          ) : item.parcelles ? (
            <div>Parcelles : {item.parcelles}</div>
          ) : null}
          {typeof fiche.nb_logements === "number" ? <div>{fiche.nb_logements} logement(s)</div> : null}
          {typeof fiche.surface_creee === "number" ? <div>Surface créée : {fiche.surface_creee} m²</div> : null}
        </div>
      ) : null}
    </div>
  );
}
