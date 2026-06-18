import { NavLink, Outlet, useParams, Navigate } from "react-router-dom";
import { BookOpen, FileStack, FileText, MessageSquare } from "lucide-react";
import { useCommuneAccess } from "../auth/CommuneAccessContext";
import { canAccessCommuneSlug, resolveCommuneRedirectPath } from "../auth/communeAccess";
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
  reglements: { segment: "reglements", title: "Règlements", Icon: BookOpen },
  documents: { segment: "documents", title: "Documents officiels Géoportail", Icon: FileStack },
};

export default function CommuneLayout() {
  const { communeSlug } = useParams<{ communeSlug: string }>();
  const { loading, allowedSlugs } = useCommuneAccess();

  if (loading) {
    return (
      <div className="commune-portal-fallback commune-portal-fallback--loading">
        Chargement des droits d&apos;accès…
      </div>
    );
  }

  if (!isCommunePortalSlug(communeSlug)) {
    return <div className="commune-portal-fallback">Commune introuvable</div>;
  }

  if (!canAccessCommuneSlug(communeSlug, allowedSlugs)) {
    return <Navigate to={resolveCommuneRedirectPath({ allowedSlugs, unrestricted: false })} replace />;
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
  const { loading, allowedSlugs } = useCommuneAccess();

  if (loading) {
    return (
      <div className="commune-portal-fallback commune-portal-fallback--loading">
        Chargement…
      </div>
    );
  }

  if (!isCommunePortalSlug(communeSlug)) {
    return <Navigate to="/" replace />;
  }

  if (!canAccessCommuneSlug(communeSlug, allowedSlugs)) {
    return <Navigate to={resolveCommuneRedirectPath({ allowedSlugs, unrestricted: false })} replace />;
  }

  const first = getCommunePortal(communeSlug)!.tools[0];
  return <Navigate to={`/${communeSlug}/${first}`} replace />;
}
