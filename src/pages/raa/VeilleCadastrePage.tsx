import { getRaaConfig } from "./raaConfig";
import VeilleCadastre from "./VeilleCadastre";

const SHELL_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap");
.rv{
  --accent:#85e372; --accent-hover:#289f01; --accent-soft:rgba(133,227,114,.14);
  --text:#111; --muted:#4b4b4b; --faint:#8a8d92; --border:#e8e8e8; --surface:#fafafa;
  --font:"Kerelia Sans","Inter",-apple-system,system-ui,sans-serif;
  font-family:var(--font); color:var(--text); background:#fff;
  flex:1; min-height:0; height:100%; width:100%; max-width:none;
  display:flex; flex-direction:column; overflow:hidden;
  padding:1.15rem 1.25rem 0;
}
.rv--scroll{overflow-y:auto; -webkit-overflow-scrolling:touch; padding-bottom:4rem;}
.rv *{box-sizing:border-box;}
.rv__head{display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:.7rem;
  flex-shrink:0;}
.rv__eyebrow{font-size:.72rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--faint);}
.rv__title{font-size:1.45rem; font-weight:600; margin:.2rem 0 0; letter-spacing:-.01em;}
.rv__sub{font-size:.86rem; color:var(--muted); line-height:1.45; max-width:44rem; margin:0;}
.rv__demo{display:inline-block; margin-top:.4rem; font-size:.72rem; color:#b07a00; background:#fff6e0;
  border:1px solid #f0d9a0; border-radius:.4rem; padding:.15rem .45rem;}
@media (max-width: 720px) {
  .rv__head{flex-direction:column;}
  .rv__title{font-size:1.25rem;}
}
`;

export default function VeilleCadastrePage({ communeSlug }: { communeSlug: string }) {
  const cfg = getRaaConfig(communeSlug);
  if (!cfg) {
    return (
      <div className="commune-portal-fallback">
        <p>La veille cadastrale n&apos;est pas disponible pour cette commune.</p>
      </div>
    );
  }

  return (
    <div className="rv rv--scroll">
      <style>{SHELL_CSS}</style>
      <VeilleCadastre cfg={cfg} />
    </div>
  );
}
