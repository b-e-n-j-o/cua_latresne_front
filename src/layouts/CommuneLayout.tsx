import { NavLink, Outlet, useParams, Navigate } from "react-router-dom";
import { BookOpen, FileStack, FileText, Grid3x3, History, MessageSquare, Newspaper } from "lucide-react";
import { useCommuneAccess } from "../auth/CommuneAccessContext";
import { canAccessCommuneSlug, resolveCommuneRedirectPath } from "../auth/communeAccess";
import {
  getCommunePortal,
  isCommunePortalSlug,
  type PortalToolId,
} from "./communePortalConfig";
import CommunePortalUserMenu from "./CommunePortalUserMenu";
import { RAA_NAV_BADGE_ENABLED } from "../pages/raa/raaConfig";
import { RaaUnreadProvider, useRaaUnread } from "../pages/raa/RaaUnreadContext";

import "./CommuneLayout.css";

const TOOL_META: Record<
  PortalToolId,
  { segment: string; title: string; Icon: typeof FileText }
> = {
  cua: { segment: "cua", title: "Certificats d’urbanisme", Icon: FileText },
  chat: { segment: "chat", title: "Assistant PLU", Icon: MessageSquare },
  reglements: { segment: "reglements", title: "Règlements CUAs", Icon: BookOpen },
  documents: { segment: "documents", title: "Documents officiels Géoportail", Icon: FileStack },
  raa: { segment: "raa", title: "Veille des arrêtés RAA", Icon: Newspaper },
  cadastre: { segment: "cadastre", title: "Veille cadastrale", Icon: Grid3x3 },
  historique: { segment: "historique", title: "Historique des parcelles", Icon: History },
};

function NavTools({ communeSlug, tools }: { communeSlug: string; tools: PortalToolId[] }) {
  const { unreadRouge } = useRaaUnread();
  const badge = unreadRouge > 9 ? "9+" : String(unreadRouge);

  return (
    <div className="commune-portal__nav-tools">
      {tools.map((toolId) => {
        const { segment, title, Icon } = TOOL_META[toolId];
        const showBadge = toolId === "raa" && RAA_NAV_BADGE_ENABLED && unreadRouge > 0;
        const label = showBadge
          ? `${title} — ${unreadRouge} recueil${unreadRouge > 1 ? "s" : ""} concernant la commune`
          : title;
        return (
          <NavLink
            key={toolId}
            to={`/${communeSlug}/${segment}`}
            title={label}
            aria-label={label}
            className={({ isActive }) =>
              `commune-portal__nav-item${isActive ? " commune-portal__nav-item--active" : ""}`
            }
          >
            <Icon size={22} strokeWidth={1.75} aria-hidden />
            <span className="commune-portal__nav-label">{title}</span>
            {showBadge ? (
              <span className="commune-portal__nav-badge" aria-hidden>
                {badge}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </div>
  );
}

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
  const raaEnabled = portal.tools.includes("raa") && RAA_NAV_BADGE_ENABLED;

  return (
    <RaaUnreadProvider communeSlug={communeSlug} enabled={raaEnabled}>
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

          <NavTools communeSlug={communeSlug} tools={portal.tools} />

          <CommunePortalUserMenu communeLabel={portal.label} />
        </nav>

        <main className="commune-portal__content">
          <Outlet context={{ communeSlug, portal }} />
        </main>
      </div>
    </RaaUnreadProvider>
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
