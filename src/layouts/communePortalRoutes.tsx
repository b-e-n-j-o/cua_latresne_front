import type { ComponentType } from "react";
import { useParams } from "react-router-dom";
import PluChat from "../pages/plu-chat/PluChat";
import type { PluCommuneSlug } from "../pages/plu-chat/communeConfig";
import LatresneCuaPage from "../pages/communes/latresne/cua/LatresnePage";
import ArgelesCuaPage from "../pages/communes/argeles/cua/ArgelesPage";
import CuaCataloguePage from "../pages/communes/argeles/cua/CuaCataloguePage";
import MiosCuaPage from "../pages/communes/mios/MiosPage";
import LatresneProjectPage from "../pages/communes/latresne/cua/ProjectPage";
import MiosProjectPage from "../pages/communes/mios/ProjectPage";
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
  return <CommuneToolUnavailable tool="cua" />;
}

function CommuneToolUnavailable({ tool }: { tool: "cua" | "chat" }) {
  const { communeSlug } = useParams<{ communeSlug: string }>();
  const portal = getCommunePortal(communeSlug);
  const label = tool === "cua" ? "CUA" : "Assistant PLU";
  const fallback = portal && isCommunePortalSlug(communeSlug) ? defaultToolPath(communeSlug) : "/";

  return (
    <div className="commune-portal-fallback">
      <p>L’outil {label} n’est pas disponible pour cette commune.</p>
      <a href={fallback}>Retour au portail</a>
    </div>
  );
}
