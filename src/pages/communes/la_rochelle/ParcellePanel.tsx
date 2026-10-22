import { useState } from "react";
import { ChevronLeft, FileText, Search, X } from "lucide-react";
import {
  formatM,
  formatM2,
  formatPct,
  type ParcelleSel,
  type RapportCroisement,
} from "./cartoTypes";
import { COMMUNES_LR } from "./communesLarochelle";
import { telechargerCifPdf } from "./cifPdf";
import { chercherParcelle } from "./parcellesLr";

type Props = {
  parcelles: ParcelleSel[];
  rapport: RapportCroisement | null;
  analyseEnCours: boolean;
  analyseErreur: string | null;
  message: string | null;
  onAjouter: (parcelle: ParcelleSel) => void;
  onRetirer: (cle: string) => void;
  onVider: () => void;
  onCadrer: (parcelle: ParcelleSel) => void;
  onFermer: () => void;
};

export default function ParcellePanel({
  parcelles,
  rapport,
  analyseEnCours,
  analyseErreur,
  message,
  onAjouter,
  onRetirer,
  onVider,
  onCadrer,
  onFermer,
}: Props) {
  const [insee, setInsee] = useState("17300");
  const [section, setSection] = useState("");
  const [numero, setNumero] = useState("");
  const [recherche, setRecherche] = useState(false);
  const [erreurRecherche, setErreurRecherche] = useState<string | null>(null);
  const plusieurs = parcelles.length > 1;

  async function soumettre() {
    setErreurRecherche(null);
    setRecherche(true);
    try {
      const parcelle = await chercherParcelle(insee, section, numero);
      onAjouter(parcelle);
    } catch (err) {
      setErreurRecherche(err instanceof Error ? err.message : "Parcelle introuvable.");
    } finally {
      setRecherche(false);
    }
  }

  return (
    <aside className="carto-left-sidebar" aria-label="Parcelles">
      <div className="carto-left-sidebar__inner">
        <div className="carto-left-sidebar__header">
          <button
            type="button"
            className="carto-left-sidebar__header-toggle"
            onClick={onFermer}
            aria-label="Replier le panneau"
            title="Replier"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pb-3">
          <div className="flex min-h-0 max-h-[calc(100%-6.75rem)] flex-col gap-3 overflow-y-auto">
          <section className="carto-left-sidebar__block carto-left-sidebar__block--search">
            <div className="carto-left-sidebar__block-trigger" style={{ cursor: "default" }}>
              <span className="carto-left-sidebar__block-trigger-label">
                <span className="carto-left-sidebar__block-icon">
                  <Search size={15} aria-hidden />
                </span>
                <span className="carto-left-sidebar__block-title">Rechercher une parcelle</span>
              </span>
            </div>
            <div className="carto-left-sidebar__block-body">
              <form
                className="carto-left-sidebar__search"
                onSubmit={(e) => {
                  e.preventDefault();
                  void soumettre();
                }}
              >
                <div className="parcelle-search-form__fields">
                  <div className="parcelle-search-form__row">
                    <label className="parcelle-search-form__label" htmlFor="lr-commune">
                      Commune
                    </label>
                    <select
                      id="lr-commune"
                      className="parcelle-search-form__input"
                      value={insee}
                      onChange={(e) => setInsee(e.target.value)}
                    >
                      {[...COMMUNES_LR].sort((a, b) => a.nom.localeCompare(b.nom, "fr")).map((c) => (
                        <option key={c.insee} value={c.insee}>
                          {c.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="parcelle-search-form__row">
                    <label className="parcelle-search-form__label" htmlFor="lr-section">
                      Section
                    </label>
                    <input
                      id="lr-section"
                      className="parcelle-search-form__input"
                      placeholder="ex. AB"
                      value={section}
                      autoComplete="off"
                      onChange={(e) => setSection(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="parcelle-search-form__row">
                    <label className="parcelle-search-form__label" htmlFor="lr-numero">
                      Numéro
                    </label>
                    <input
                      id="lr-numero"
                      className="parcelle-search-form__input"
                      placeholder="ex. 0042"
                      value={numero}
                      autoComplete="off"
                      onChange={(e) => setNumero(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="parcelle-search-form__submit" disabled={recherche}>
                    <Search size={14} aria-hidden />
                    {recherche ? "Recherche…" : "Rechercher la parcelle"}
                  </button>
                  {erreurRecherche ? (
                    <p className="m-0 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-800">{erreurRecherche}</p>
                  ) : null}
                  {message ? (
                    <p className="m-0 rounded-md bg-orange-50 px-2 py-1.5 text-[11px] text-orange-900">{message}</p>
                  ) : null}
                  <p className="parcelle-search-form__hint">
                    Cliquez une parcelle sur la carte pour l&apos;ajouter ou la retirer. Les parcelles d&apos;une unité
                    foncière n&apos;ont pas besoin d&apos;être contiguës.
                  </p>
                </div>
              </form>
            </div>
          </section>

          {parcelles.length ? (
            <section className="shrink-0 space-y-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-xs font-semibold text-amber-950">
                  {plusieurs
                    ? `Unité foncière en cours (${parcelles.length} parcelles)`
                    : "Parcelle sélectionnée"}
                </div>
                <button type="button" className="text-[10px] text-amber-800 underline" onClick={onVider}>
                  Tout retirer
                </button>
              </div>
              <ul className="max-h-36 space-y-1 overflow-y-auto">
                {parcelles.map((p) => (
                  <li
                    key={p.cle}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-200/80 bg-white/90 px-2 py-1.5"
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onCadrer(p)}>
                      <div className="text-xs font-semibold text-gray-900">
                        Section {p.section} – Parcelle {p.numero}
                      </div>
                      <div className="truncate text-[10px] text-gray-500">
                        {p.commune}
                        {p.contenanceM2 != null ? ` · ${formatM2(p.contenanceM2)}` : ""}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRetirer(p.cle)}
                      className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Retirer de l'unité foncière"
                      aria-label={`Retirer ${p.section} ${p.numero}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="text-[11px] leading-snug text-amber-900">
                <div>Surface cadastrale : {formatM2(rapport?.contenanceM2)}</div>
                <div>Surface graphique : {formatM2(rapport?.surfaceGraphiqueM2)}</div>
              </div>
            </section>
          ) : (
            <p className="parcelle-search-form__hint px-1">
              Aucune parcelle. Zoomez au moins au niveau 14, ou lancez une recherche.
            </p>
          )}
          </div>

          <div className="shrink-0">
            <button
              type="button"
              disabled={!parcelles.length || !rapport || analyseEnCours}
              onClick={() => {
                if (rapport) telechargerCifPdf(parcelles, rapport);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-green-700 disabled:opacity-60"
            >
              <FileText size={16} />
              <span>Carte d&apos;identité foncière</span>
            </button>
            <p className="parcelle-search-form__hint mt-1.5">
              Ébauche : récapitulatif des couches croisées, pas un certificat d&apos;urbanisme.
            </p>
          </div>

          {parcelles.length ? (
            <section className="carto-left-sidebar__block min-h-0 flex-1 overflow-y-auto">
              <div className="carto-left-sidebar__block-trigger" style={{ cursor: "default" }}>
                <span className="carto-left-sidebar__block-title">
                  Croisements
                  {rapport ? (
                    <span className="font-medium text-[#0b131f]/45">
                      {" "}
                      {rapport.nTouchees}/{rapport.nFamilles}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="carto-left-sidebar__block-body space-y-1 px-3 py-2">
                {analyseEnCours ? <p className="parcelle-search-form__hint">Lecture des couches sur l&apos;emprise…</p> : null}
                {analyseErreur ? (
                  <p className="m-0 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-800">{analyseErreur}</p>
                ) : null}
                {rapport?.avertissement ? (
                  <p className="m-0 rounded-md bg-orange-50 px-2 py-1.5 text-[11px] text-orange-900">{rapport.avertissement}</p>
                ) : null}
                {rapport
                  ? rapport.groupes.map((g) => (
                      <details key={g.code} open={g.familles.length > 0} className="border-t border-[#d5e1e3] py-1.5 first:border-t-0">
                        <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-[#0b131f]">
                          {g.label}
                          <span className="font-medium text-[#0b131f]/45">{g.familles.length}</span>
                        </summary>
                        {g.familles.map((f) => (
                          <div key={f.itemId} className="py-1 pl-1">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.couleur }} />
                              <span className="text-xs font-semibold text-[#0b131f]">{f.label}</span>
                            </div>
                            <div className="ml-4 text-[11px] text-[#0b131f]/70">{resumeFamille(f)}</div>
                            <ul className="ml-4 list-none p-0">
                              {f.objets.slice(0, 8).map((o) => (
                                <li key={o.libelle} className="flex justify-between gap-2 py-px text-[11px] text-[#0b131f]/80">
                                  <span>{o.libelle}</span>
                                  <span className="shrink-0 text-[#0b131f]/45">{resumeObjet(o)}</span>
                                </li>
                              ))}
                              {f.objets.length > 8 ? (
                                <li className="text-[11px] text-[#0b131f]/45">+ {f.objets.length - 8} autre(s)</li>
                              ) : null}
                            </ul>
                          </div>
                        ))}
                        {g.sans.length ? (
                          <p className="m-0 mt-1 text-[10px] leading-snug text-[#0b131f]/45">
                            Sans intersection : {g.sans.join(", ")}
                          </p>
                        ) : null}
                      </details>
                    ))
                  : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function resumeFamille(f: RapportCroisement["groupes"][number]["familles"][number]): string {
  const parts: string[] = [];
  if (f.surfaceM2 >= 1) parts.push(`${formatM2(f.surfaceM2)}${f.pct != null ? ` · ${formatPct(f.pct)}` : ""}`);
  if (f.longueurM >= 0.5) parts.push(formatM(f.longueurM));
  if (f.nbPoints > 0) parts.push(f.nbPoints > 1 ? `${f.nbPoints} points` : "1 point");
  return parts.join(" · ");
}

function resumeObjet(o: RapportCroisement["groupes"][number]["familles"][number]["objets"][number]): string {
  const parts: string[] = [];
  if (o.surfaceM2 >= 1) parts.push(o.pct != null ? formatPct(o.pct) : formatM2(o.surfaceM2));
  if (o.longueurM >= 0.5) parts.push(formatM(o.longueurM));
  if (o.nbPoints > 0) parts.push("présent");
  return parts.join(" · ");
}
