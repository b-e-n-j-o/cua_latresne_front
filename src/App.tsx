import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AuthGate from "./auth/AuthGate";
import LoginForm from "./auth/LoginForm";
import SignupForm from "./auth/SignupForm";
import ResetPasswordPage from "./auth/ResetPasswordPage";
import UpdatePasswordPage from "./auth/UpdatePasswordPage";
import LandingPage from "./pages/website/landingpage/LandingPage";
import RedirectSlugPage from "./routes/RedirectSlugPage";
import HistoryPanel from "./HistoryPanel";
import { AdminMonitoringPage } from "./pages/admin";
import ReglementsAdminPage from "./pages/reglements/ReglementsAdmin";
import CuaViewer from "./routes/CuaViewer";
import MapsViewer from "./routes/MapsViewer";
import PluChat from "./pages/plu-chat/PluChat";
import LidarViewerPage from "./pages/visualisations_de_test/lidar/LidarViewerPage";
import MntViewerPage from "./pages/visualisations_de_test/mnt/MntViewerPage";
import LatresneTilesPage from "./pages/communes/latresne/cua/LatresnePagePMTiles";
import CommuneLayout, { CommunePortalEntry } from "./layouts/CommuneLayout";
import HistoriqueFiliationPage from "./pages/historique/HistoriqueFiliationPage";
import {
  CommuneCatalogueRoute,
  CommuneCuaRoute,
  CommuneChatRoute,
  CommuneProjectRoute,
  CommuneReglementsRoute,
  CommuneDocumentsRoute,
  CommuneRaaRoute,
  CommuneCadastreRoute,
  LarochellePublicCuaPage,
} from "./layouts/communePortalRoutes";
import DemoRequestPage from "./pages/website/DemoRequestPage";
import MarkdownBatchPage from "./pages/tools/MarkdownBatchPage";
import LlmPlaygroundPage from "./pages/tools/LlmPlaygroundPage";
import { editorialPages, EditorialRegistryPage } from "./pages/website/websitePages";

const HistoryPage = () => (
  <HistoryPanel apiBase={import.meta.env.VITE_API_BASE || ""} />
);

const PUBLIC_EXACT_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/demo",
  "/reset-password",
  "/update-password",
  "/notre-equipe",
  "/chat-urba",
  "/latresne",
  "/lidar",
  "/mnt",
  "/carto",
  "/maps",
  ...editorialPages.map((page) => page.path),
  "/larochelle/cua",
];
const PUBLIC_PREFIX_ROUTES = ["/m/", "/cua", "/maps"];

export default function App() {
  const location = useLocation();
  const path = location.pathname;

  const isExactPublic = PUBLIC_EXACT_ROUTES.includes(path);
  const isPrefixPublic = PUBLIC_PREFIX_ROUTES.some((prefix) => path.startsWith(prefix));
  const isPublic = isExactPublic || isPrefixPublic;

  if (isPublic) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/signup" element={<SignupForm />} />
        <Route path="/demo" element={<DemoRequestPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        <Route path="/notre-equipe" element={<Navigate to={{ pathname: "/", hash: "equipe" }} replace />} />
        <Route path="/cua" element={<CuaViewer />} />
        <Route path="/maps" element={<MapsViewer />} />
        <Route path="/chat-urba" element={<PluChat commune="france" />} />
        <Route path="/latresne" element={<div>Page introuvable</div>} />
        <Route path="/lidar" element={<LidarViewerPage />} />
        <Route path="/mnt" element={<MntViewerPage />} />
        <Route path="/carto" element={<LatresneTilesPage />} />
        <Route path="/larochelle/cua" element={<LarochellePublicCuaPage />} />
        {editorialPages.map((page) => (
          <Route key={page.path} path={page.path} element={<EditorialRegistryPage entry={page} />} />
        ))}
        <Route path="/m/:slug" element={<RedirectSlugPage />} />
        <Route path="*" element={<div>Page introuvable</div>} />
      </Routes>
    );
  }

  return (
    <AuthGate>
      <Routes>
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/admin" element={<AdminMonitoringPage />} />
        <Route path="/admin/db" element={<Navigate to="/admin" replace />} />
        <Route path="/admin/reglement" element={<ReglementsAdminPage />} />
        <Route path="/markdown" element={<MarkdownBatchPage />} />
        <Route path="/llm" element={<LlmPlaygroundPage />} />

        {/* Portail cartographique par commune (barre latérale + outils) */}
        <Route path="/:communeSlug" element={<CommuneLayout />}>
          <Route index element={<CommunePortalEntry />} />
          <Route path="catalogue" element={<CommuneCatalogueRoute />} />
          <Route path="cua" element={<CommuneCuaRoute />} />
          <Route path="cua/projects/:slug" element={<CommuneProjectRoute />} />
          <Route path="chat" element={<CommuneChatRoute />} />
          <Route path="reglements" element={<CommuneReglementsRoute />} />
          <Route path="documents" element={<CommuneDocumentsRoute />} />
          <Route path="raa" element={<CommuneRaaRoute />} />
          <Route path="cadastre" element={<CommuneCadastreRoute />} />
          <Route path="historique" element={<HistoriqueFiliationPage />} />
        </Route>
        <Route path="*" element={<div>Page introuvable</div>} />
      </Routes>
    </AuthGate>
  );
}
