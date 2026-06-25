import { useEffect, useState, type ComponentType } from "react";
import { useParams } from "react-router-dom";
import supabase from "../supabaseClient";
import ReglementsArgeles from "../pages/reglements/ReglementsArgeles";
import DocumentsOfficiels from "../pages/documents/DocumentsOfficiels";
import PluChat from "../pages/plu-chat/PluChat";
import type { PluCommuneSlug } from "../pages/plu-chat/communeConfig";
import LatresneCuaPage from "../pages/communes/latresne/cua/LatresnePage";
import ArgelesCuaPage from "../pages/communes/argeles/cua/ArgelesPage";
import CuaCataloguePage from "../pages/communes/argeles/cua/CuaCataloguePage";
import MiosCuaPage from "../pages/communes/mios/MiosPage";
import LatresneProjectPage from "../pages/communes/latresne/cua/ProjectPage";
import MiosProjectPage from "../pages/communes/mios/ProjectPage";
import ArgelesProjectPage from "../pages/communes/argeles/cua/ProjectPage";
import VeilleRaaPage from "../pages/raa/Raa";
import { isRaaCommuneSlug } from "../pages/raa/raaConfig";
import {
  defaultToolPath,
  getCommunePortal,
  isCommunePortalSlug,
  isCuaPageSlug,
  type CuaPageSlug,
} from "./communePortalConfig";

const CUA_PAGES: Record<CuaPageSlug, ComponentType> = {
  latresne: LatresneCuaPage,
  argeles: ArgelesCuaPage,
  mios: MiosCuaPage,
};

function isPluChatCommune(slug: string | undefined): slug is PluCommuneSlug {
  return slug === "argeles" || slug === "latresne" || slug === "mios" || slug === "france";
}

export function CommuneCatalogueRoute() {
  return <CuaCataloguePage />;
}

export function CommuneCuaRoute() {
  const { communeSlug } = useParams<{ communeSlug: string }>();
  if (!isCuaPageSlug(communeSlug)) {
    return <CommuneToolUnavailable tool="cua" />;
  }
  const Page = CUA_PAGES[communeSlug];
  return <Page />;
}

export function CommuneChatRoute() {
  const { communeSlug } = useParams<{ communeSlug: string }>();
  const portal = getCommunePortal(communeSlug);
  if (!portal?.tools.includes("chat") || !isPluChatCommune(communeSlug)) {
    return <CommuneToolUnavailable tool="chat" />;
  }
  return <PluChat commune={communeSlug} />;
}

export function CommuneProjectRoute() {
  const { communeSlug } = useParams<{ communeSlug: string }>();
  if (communeSlug === "latresne") return <LatresneProjectPage />;
  if (communeSlug === "mios") return <MiosProjectPage />;
  if (communeSlug === "argeles") return <ArgelesProjectPage />;
  return <CommuneToolUnavailable tool="cua" />;
}

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

export function CommuneReglementsRoute() {
  const { communeSlug } = useParams<{ communeSlug: string }>();
  const portal = getCommunePortal(communeSlug);
  const [token, setToken] = useState<string | undefined>(
    () => import.meta.env.VITE_ADMIN_API_TOKEN || undefined,
  );

  useEffect(() => {
    if (import.meta.env.VITE_ADMIN_API_TOKEN) return;
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token);
    });
  }, []);

  if (!portal?.tools.includes("reglements") || !communeSlug) {
    return <CommuneToolUnavailable tool="reglements" />;
  }

  return <ReglementsArgeles apiBase={API_BASE} token={token} communeSlug={communeSlug} />;
}

export function CommuneDocumentsRoute() {
  const { communeSlug } = useParams<{ communeSlug: string }>();
  const portal = getCommunePortal(communeSlug);
  const [token, setToken] = useState<string | undefined>(
    () => import.meta.env.VITE_ADMIN_API_TOKEN || undefined,
  );

  useEffect(() => {
    if (import.meta.env.VITE_ADMIN_API_TOKEN) return;
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token);
    });
  }, []);

  if (!portal?.tools.includes("documents") || !communeSlug) {
    return <CommuneToolUnavailable tool="documents" />;
  }

  return <DocumentsOfficiels apiBase={API_BASE} token={token} communeSlug={communeSlug} />;
}

export function CommuneRaaRoute() {
  const { communeSlug } = useParams<{ communeSlug: string }>();
  const portal = getCommunePortal(communeSlug);

  if (!portal?.tools.includes("raa") || !communeSlug || !isRaaCommuneSlug(communeSlug)) {
    return <CommuneToolUnavailable tool="raa" />;
  }

  return <VeilleRaaPage communeSlug={communeSlug} />;
}

function CommuneToolUnavailable({ tool }: { tool: "cua" | "chat" | "reglements" | "documents" | "raa" }) {
  const { communeSlug } = useParams<{ communeSlug: string }>();
  const portal = getCommunePortal(communeSlug);
  const label =
    tool === "cua"
      ? "CUA"
      : tool === "chat"
        ? "Assistant PLU"
        : tool === "reglements"
          ? "Règlements"
          : tool === "raa"
            ? "Veille réglementaire"
            : "Documents officiels";
  const fallback = portal && isCommunePortalSlug(communeSlug) ? defaultToolPath(communeSlug) : "/";

  return (
    <div className="commune-portal-fallback">
      <p>L’outil {label} n’est pas disponible pour cette commune.</p>
      <a href={fallback}>Retour au portail</a>
    </div>
  );
}
