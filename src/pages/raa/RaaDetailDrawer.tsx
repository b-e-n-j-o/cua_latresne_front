import { AlertTriangle, ArrowRight, ExternalLink, EyeOff, FileText, Loader2, RefreshCw, X } from "lucide-react";
import type { RaaCommuneConfig } from "./raaConfig";
import {
  fmtJour,
  isNouveau,
  natureMeta,
  pdfUrlAtPage,
  pertinenceMeta,
  sortArretes,
  type RaaItem,
} from "./raaShared";

type RaaDetailDrawerProps = {
  item: RaaItem | null;
  cfg: RaaCommuneConfig;
  detailLoading: boolean;
  masquerLoading: boolean;
  onClose: () => void;
  onAnalyser: () => void;
  onMarquerVu: () => void;
  onMasquer: () => void;
};

export default function RaaDetailDrawer({
  item,
  cfg,
  detailLoading,
  masquerLoading,
  onClose,
  onAnalyser,
  onMarquerVu,
  onMasquer,
}: RaaDetailDrawerProps) {
  if (!item) {
    return (
      <aside className="rv-drawer rv-drawer--empty" aria-label="Détail du recueil">
        <style>{DRAWER_CSS}</style>
        <div className="rv-drawer__empty">
          <FileText size={28} strokeWidth={1.5} />
          <p>Sélectionnez un recueil à gauche pour voir les arrêtés et le détail de l&apos;analyse.</p>
        </div>
      </aside>
    );
  }

  const nouveau = isNouveau(item);
  const enCours = item.statut === "en_cours";
  const erreur = item.statut === "erreur";
  const analyse = item.statut === "analyse";
  const detecte = item.statut === "detecte";
  const arretes = sortArretes(item.arretes ?? []);
  const nbTotal = item.nb_arretes_total ?? arretes.length;

  return (
    <aside className="rv-drawer" aria-label={`Détail — ${item.titre}`}>
      <style>{DRAWER_CSS}</style>

      <header className="rv-drawer__head">
        <div className="rv-drawer__kicker">{fmtJour(item.date_publication)}</div>
        <div className="rv-drawer__title-row">
          <h2 className="rv-drawer__title">{item.titre}</h2>
          <a
            className="rv-drawer__pdf"
            href={item.pdf_url}
            target="_blank"
            rel="noreferrer"
            title="Ouvrir le PDF officiel du recueil"
          >
            Voir le PDF officiel
            <ArrowRight size={15} strokeWidth={2.25} />
          </a>
          <button type="button" className="rv-drawer__close" onClick={onClose} aria-label="Fermer le détail">
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="rv-drawer__body">
        {analyse && item.resume_global && (
          <section className="rv-drawer__block" aria-labelledby={`raa-resume-${item.id}`}>
            <h3 className="rv-drawer__section" id={`raa-resume-${item.id}`}>Résumé global</h3>
            <p className="rv-drawer__resume">{item.resume_global}</p>
          </section>
        )}

        {enCours && (
          <p className="rv__statusline rv__statusline--wait">
            <Loader2 size={14} className="rv__spin" /> Analyse en cours… (jusqu&apos;à ~1 min pour les gros recueils)
          </p>
        )}
        {detecte && <p className="rv__statusline">Pas encore analysé. Lancez l&apos;analyse pour extraire les arrêtés.</p>}
        {erreur && (
          <p className="rv__statusline rv__statusline--err">
            <AlertTriangle size={14} /> {item.erreur || "L'analyse a échoué."} Vous pouvez relancer.
          </p>
        )}

        {analyse && nbTotal > 0 && (
          <section className="rv-drawer__arretes-wrap" aria-label="Arrêtés du recueil">
            <h3 className="rv-drawer__section">
              Arrêtés
              <em>
                {arretes.length || nbTotal} dans ce recueil
                {(item.nb_arretes_pertinents ?? 0) > 0 && ` · ${item.nb_arretes_pertinents} à examiner pour ${cfg.communeShort}`}
              </em>
            </h3>

            {detailLoading ? (
              <p className="rv__statusline rv__statusline--wait">
                <Loader2 size={14} className="rv__spin" /> Chargement du détail…
              </p>
            ) : arretes.length === 0 ? (
              <p className="rv__statusline">Aucun arrêté détaillé disponible pour ce recueil.</p>
            ) : (
              <ol className="rv__arretes">
                {arretes.map((a, i) => {
                  const pm = pertinenceMeta(a.pertinence);
                  const nm = natureMeta(a.nature);
                  const tone =
                    a.pertinence === "DIRECTE" ? "r"
                    : a.pertinence === "INDIRECTE" || a.pertinence === "POSSIBLE" ? "o"
                    : "v";
                  const href = pdfUrlAtPage(item.pdf_url, a.pages);
                  const pageStart = a.pages?.match(/(\d+)/)?.[1];
                  const body = (
                    <>
                      <div className="rv__arrete-top">
                        <div className="rv__arrete-index">
                          Arrêté {i + 1}
                          <span>sur {arretes.length}</span>
                        </div>
                        {href && (
                          <span className="rv-drawer__pdf rv__arrete-hint">
                            Voir le PDF officiel{pageStart ? ` · p. ${pageStart}` : ""}
                            <ArrowRight size={15} strokeWidth={2.25} />
                          </span>
                        )}
                      </div>
                      <h4 className="rv__arretetitre">{a.titre}</h4>
                      <dl className="rv__arrete-fields">
                        {a.pages && (
                          <div className="rv__field">
                            <dt>Pages</dt>
                            <dd>{a.pages}</dd>
                          </div>
                        )}
                        <div className="rv__field">
                          <dt>Concernant {cfg.communeShort}</dt>
                          <dd style={{ color: pm.dot }} title={pm.hint}>{pm.label}</dd>
                        </div>
                        <div className="rv__field">
                          <dt>Catégorie</dt>
                          <dd><span className={`rv__nature ${nm.className}`}>{nm.label}</span></dd>
                        </div>
                        {a.reference && (
                          <div className="rv__field">
                            <dt>Référence</dt>
                            <dd>{a.reference}</dd>
                          </div>
                        )}
                        {a.raison && (
                          <div className="rv__field rv__field--block">
                            <dt>Pourquoi c&apos;est signalé</dt>
                            <dd>{a.raison}</dd>
                          </div>
                        )}
                        {a.resume && (
                          <div className="rv__field rv__field--block">
                            <dt>Résumé de l&apos;arrêté</dt>
                            <dd>{a.resume}</dd>
                          </div>
                        )}
                      </dl>
                    </>
                  );
                  return (
                    <li key={i}>
                      {href ? (
                        <a
                          className={`rv__arrete rv__arrete--${tone} rv__arrete--link`}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          title={pageStart ? `Ouvrir le PDF officiel à la page ${pageStart}` : "Ouvrir le PDF officiel"}
                        >
                          {body}
                        </a>
                      ) : (
                        <div className={`rv__arrete rv__arrete--${tone}`}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}
      </div>

      <footer className="rv-drawer__foot">
        <a className="rv__link" href={item.page_url} target="_blank" rel="noreferrer">
          <ExternalLink size={13} /> Page préfecture
        </a>

        <span className="rv__spacer" />

        {nouveau && (
          <button type="button" className="rv__vu" onClick={onMarquerVu} title="Marquer comme lu">
            Marquer comme lu
          </button>
        )}

        <button
          type="button"
          className="rv__btn rv__btn--ghost"
          onClick={onMasquer}
          disabled={enCours || masquerLoading}
          title="Retirer ce recueil de la veille"
        >
          {masquerLoading ? <Loader2 size={14} className="rv__spin" /> : <EyeOff size={14} />}
          Retirer
        </button>

        <button type="button" className="rv__btn" onClick={onAnalyser} disabled={enCours}>
          {enCours ? <Loader2 size={14} className="rv__spin" /> : <RefreshCw size={14} />}
          {detecte ? "Analyser" : enCours ? "En cours" : "Relancer l'analyse"}
        </button>
      </footer>
    </aside>
  );
}

const DRAWER_CSS = `
.rv-drawer{display:flex; flex-direction:column; min-height:0; height:100%; background:#fff;}
.rv-drawer--empty{align-items:center; justify-content:center;}
.rv-drawer__empty{display:flex; flex-direction:column; align-items:center; gap:.75rem;
  padding:2rem 1.5rem; text-align:center; color:var(--faint); max-width:22rem;}
.rv-drawer__empty p{margin:0; font-size:.9rem; line-height:1.5;}
.rv-drawer__head{flex-shrink:0; padding:1.15rem 1.25rem 1rem; border-bottom:1px solid var(--border);}
.rv-drawer__kicker{font-size:.72rem; font-weight:600; letter-spacing:.04em; text-transform:uppercase;
  color:var(--faint); margin:0 0 .35rem;}
.rv-drawer__title-row{display:flex; align-items:flex-start; gap:.65rem;}
.rv-drawer__title{flex:1; font-size:1.2rem; font-weight:600; margin:0; line-height:1.3; letter-spacing:-.01em;}
.rv-drawer__pdf{flex-shrink:0; display:inline-flex; align-items:center; gap:.35rem; margin-top:.1rem;
  padding:.42rem .75rem; border-radius:.55rem; font-size:.78rem; font-weight:700; text-decoration:none;
  color:#1a4d0f; background:rgba(133,227,114,.42); border:1px solid rgba(40,159,1,.28);
  white-space:nowrap; transition:background .15s, border-color .15s, color .15s;}
.rv-drawer__pdf:hover{color:#123608; background:rgba(133,227,114,.6); border-color:rgba(40,159,1,.45);}
.rv-drawer__pdf svg{flex-shrink:0;}
.rv-drawer__close{flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
  width:2rem; height:2rem; border:1px solid var(--border); border-radius:.5rem; background:#fff;
  color:var(--muted); cursor:pointer;}
.rv-drawer__close:hover{background:var(--surface); color:var(--text);}
.rv-drawer__body{flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:1.1rem 1.25rem 1.4rem;}
.rv-drawer__block{margin:0 0 1.35rem; padding:0 0 1.2rem; border-bottom:1px solid var(--border);}
.rv-drawer__resume{font-size:.92rem; line-height:1.55; color:var(--text); margin:0;}
.rv-drawer__section{display:flex; align-items:baseline; flex-wrap:wrap; gap:.4rem .65rem;
  font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--faint);
  margin:0 0 .65rem;}
.rv-drawer__section em{font-style:normal; font-weight:600; text-transform:none; letter-spacing:0; color:var(--muted);}
.rv-drawer__foot{flex-shrink:0; display:flex; align-items:center; flex-wrap:wrap; gap:.55rem;
  padding:.85rem 1.25rem; border-top:1px solid var(--border); background:#fff;}

.rv__arretes{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.9rem;
  counter-reset:none;}
.rv__arrete{display:flex; flex-direction:column; gap:0; padding:1rem 1.05rem 1.05rem;
  border:1px solid transparent; border-radius:.8rem; background:#fff;
  box-shadow:0 1px 3px rgba(0,0,0,.04);}
.rv__arrete--link{text-decoration:none; color:inherit; cursor:pointer; opacity:.72;
  transition:opacity .18s ease, box-shadow .15s, border-color .15s;}
.rv__arrete--link:hover,.rv__arrete--link:focus-visible{opacity:1; box-shadow:0 2px 10px rgba(0,0,0,.08);}
.rv__arrete--r{background:#fff5f4; border-color:#f3c6c0;}
.rv__arrete--o{background:#fffaf0; border-color:#f0d9a8;}
.rv__arrete--v{background:#f6f7f6; border-color:#e2e4e1;}
.rv__arrete-top{display:flex; align-items:center; justify-content:space-between; gap:.75rem; margin:0 0 .45rem;}
.rv__arrete-index{display:flex; align-items:baseline; gap:.35rem; font-size:.72rem; font-weight:700;
  letter-spacing:.04em; text-transform:uppercase; color:#1a6fa8;}
.rv__arrete-index span{font-weight:500; letter-spacing:0; text-transform:none; color:var(--faint);}
.rv__arrete-hint{margin-top:0; opacity:0; transform:translateX(.15rem); pointer-events:none;
  transition:opacity .18s ease, transform .18s ease, background .15s, border-color .15s, color .15s;}
.rv__arrete--link:hover .rv__arrete-hint,.rv__arrete--link:focus-visible .rv__arrete-hint{
  opacity:1; transform:none;}
.rv__arretetitre{font-size:.95rem; font-weight:600; line-height:1.4; margin:0 0 .75rem;}
.rv__arrete-fields{margin:0; display:flex; flex-direction:column; gap:.55rem;}
.rv__field{display:grid; grid-template-columns:10.5rem minmax(0,1fr); gap:.4rem .85rem; align-items:start;}
.rv__field dt{font-size:.72rem; font-weight:700; letter-spacing:.02em; text-transform:uppercase;
  color:var(--faint); padding-top:.12rem;}
.rv__field dd{margin:0; font-size:.84rem; line-height:1.45; color:var(--text); font-weight:600;}
.rv__field--block{grid-template-columns:1fr;}
.rv__field--block dd{font-weight:400; color:var(--muted); line-height:1.55;}
.rv__nature{display:inline-flex; align-items:center; padding:.12rem .45rem; border-radius:.4rem;
  font-size:.74rem; font-weight:600;}
.rv__nature--urba{background:#e8f4fd; color:#1a6fa8;}
.rv__nature--env{background:#e6f6ec; color:#1a7a3a;}
.rv__nature--evt{background:#f3ebfa; color:#7d3c98;}
.rv__nature--autre{background:#f0f1f3; color:#6b7280;}

@media (max-width:560px){
  .rv__field{grid-template-columns:1fr; gap:.15rem;}
}

@media (max-width:860px){
  .rv-drawer__title-row{flex-wrap:wrap;}
  .rv-drawer__title{flex:1 1 calc(100% - 2.75rem); font-size:1.05rem;}
  .rv-drawer__close{order:2;}
  .rv-drawer__pdf{order:3; width:100%; justify-content:center;}
  .rv-drawer__foot{padding-bottom:calc(.85rem + env(safe-area-inset-bottom));}
}
`;
