import { NavLink, Outlet, useParams, Navigate } from "react-router-dom";
import { FileText, MessageSquare } from "lucide-react";
import {
  getCommunePortal,
  isCommunePortalSlug,
  type PortalToolId,
} from "./communePortalConfig";
import CommunePortalUserMenu from "./CommunePortalUserMenu";
import "./CommuneLayout.css";

const TOOL_META: Record<
  PortalToolId,
  { segment: string; title: string; Icon: typeof FileText }
> = {
  cua: { segment: "cua", title: "Certificats d’urbanisme", Icon: FileText },
  chat: { segment: "chat", title: "Assistant PLU", Icon: MessageSquare },
};

export default function CommuneLayout() {
  const { communeSlug } = useParams<{ communeSlug: string }>();

  if (!isCommunePortalSlug(communeSlug)) {
    return <div className="commune-portal-fallback">Commune introuvable</div>;
  }

  const portal = getCommunePortal(communeSlug)!;

  return (
    <div className="commune-portal" data-commune={communeSlug}>
      <nav className="commune-portal__nav" aria-label={`Outils — ${portal.label}`}>
        <a
          href="/"
          className="commune-portal__logo"
          title="Kerelia"
          aria-label="Accueil Kerelia"
        >
          <img src="/logo_kerelia_noir.png" alt="" width={32} height={32} />
        </a>

        <div className="commune-portal__nav-tools">
          {portal.tools.map((toolId) => {
            const { segment, title, Icon } = TOOL_META[toolId];
            return (
              <NavLink
                key={toolId}
                to={`/${communeSlug}/${segment}`}
                title={title}
                className={({ isActive }) =>
                  `commune-portal__nav-item${isActive ? " commune-portal__nav-item--active" : ""}`
                }
              >
                <Icon size={22} strokeWidth={1.75} aria-hidden />
                <span className="commune-portal__nav-label">{title}</span>
              </NavLink>
            );
          })}
        </div>

        <CommunePortalUserMenu communeLabel={portal.label} />
      </nav>

      <main className="commune-portal__content">
        <Outlet context={{ communeSlug, portal }} />
      </main>
    </div>
  );
}

/** Redirige /:commune vers le premier outil disponible */
export function CommunePortalEntry() {
  const { communeSlug } = useParams<{ communeSlug: string }>();
  if (!isCommunePortalSlug(communeSlug)) {
    return <Navigate to="/" replace />;
  }
  const first = getCommunePortal(communeSlug)!.tools[0];
  return <Navigate to={`/${communeSlug}/${first}`} replace />;
}
