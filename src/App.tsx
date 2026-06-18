import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AuthGate from "./auth/AuthGate";
import LoginForm from "./auth/LoginForm";
import ResetPasswordPage from "./auth/ResetPasswordPage";
import UpdatePasswordPage from "./auth/UpdatePasswordPage";
import LandingPage from "./pages/website/landingpage/LandingPage";
import LandingPageDev from "./pages/website/landingpage_dev/LandingPage";
import RedirectSlugPage from "./routes/RedirectSlugPage";
import HistoryPanel from "./HistoryPanel";
import AdminPage from "./routes/AdminPage";
import CuaViewer from "./routes/CuaViewer";
import PluChat from "./pages/plu-chat/PluChat";
import LidarViewerPage from "./pages/visualisations_de_test/lidar/LidarViewerPage";
import MntViewerPage from "./pages/visualisations_de_test/mnt/MntViewerPage";
import LatresneTilesPage from "./pages/communes/latresne/cua/LatresnePagePMTiles";
import PortailApp from "./portail/PortailApp";
import CommuneLayout, { CommunePortalEntry } from "./layouts/CommuneLayout";
import {
  CommuneCatalogueRoute,
  CommuneCuaRoute,
  CommuneChatRoute,
  CommuneProjectRoute,
  CommuneReglementsRoute,
} from "./layouts/communePortalRoutes";
import DemoRequestPage from "./pages/website/DemoRequestPage";
import MarkdownBatchPage from "./pages/tools/MarkdownBatchPage";
import {
  CertificatsUrbanismePage,
  CarteIdentiteFoncierePage,
  VeilleReglementairePage,
  ScoringCompensationPage,
  EtudesEnvironnementalesPage,
  BancarisationSuiviERCPage,
  OutilsPilotageSIGPage,
  BaseDonneesSIGPage,
  VisualisationMNTLiDARPage,
} from "./pages/website/websitePages";

const HistoryPage = () => (
  <HistoryPanel apiBase={import.meta.env.VITE_API_BASE || ""} />
);

const PUBLIC_EXACT_ROUTES = [
  "/",
  "/landing-dev",
  "/login",
  "/demo",
  "/reset-password",
  "/update-password",
  "/notre-equipe",
  "/chat-urba",
  "/latresne",
  "/lidar",
  "/mnt",
  "/carto",
  "/urbanisme/certificats-durbanisme",
  "/urbanisme/carte-didentite-fonciere",
  "/urbanisme/veille-reglementaire",
  "/environnement/scoring-compensation-ecologique",
  "/environnement/etudes-environnementales",
  "/environnement/bancarisation-suivi-erc",
  "/outils/outils-pilotage-sig",
  "/outils/base-de-donnees-sig",
  "/outils/visualisation-mnt-lidar",
];
const PUBLIC_PREFIX_ROUTES = ["/m/", "/cua"];

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
        <Route path="/landing-dev" element={<LandingPageDev />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/demo" element={<DemoRequestPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        <Route path="/notre-equipe" element={<Navigate to={{ pathname: "/", hash: "equipe" }} replace />} />
        <Route path="/cua" element={<CuaViewer />} />
        <Route path="/chat-urba" element={<PluChat commune="france" />} />
        <Route path="/latresne" element={<div>Page introuvable</div>} />
        <Route path="/lidar" element={<LidarViewerPage />} />
        <Route path="/mnt" element={<MntViewerPage />} />
        <Route path="/carto" element={<LatresneTilesPage />} />
        <Route path="/urbanisme/certificats-durbanisme" element={<CertificatsUrbanismePage />} />
        <Route path="/urbanisme/carte-didentite-fonciere" element={<CarteIdentiteFoncierePage />} />
        <Route path="/urbanisme/veille-reglementaire" element={<VeilleReglementairePage />} />
        <Route path="/environnement/scoring-compensation-ecologique" element={<ScoringCompensationPage />} />
        <Route path="/environnement/etudes-environnementales" element={<EtudesEnvironnementalesPage />} />
        <Route path="/environnement/bancarisation-suivi-erc" element={<BancarisationSuiviERCPage />} />
        <Route path="/outils/outils-pilotage-sig" element={<OutilsPilotageSIGPage />} />
        <Route path="/outils/base-de-donnees-sig" element={<BaseDonneesSIGPage />} />
        <Route path="/outils/visualisation-mnt-lidar" element={<VisualisationMNTLiDARPage />} />
        <Route path="/m/:slug" element={<RedirectSlugPage />} />
        <Route path="*" element={<div>Page introuvable</div>} />
      </Routes>
    );
  }

  return (
    <AuthGate>
      <Routes>
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/markdown" element={<MarkdownBatchPage />} />
        {/* Ancien portail démo — distinct du portail commune /:commune/outil */}
        <Route path="/portail/*" element={<PortailApp />} />

        {/* Portail cartographique par commune (barre latérale + outils) */}
        <Route path="/:communeSlug" element={<CommuneLayout />}>
          <Route index element={<CommunePortalEntry />} />
          <Route path="catalogue" element={<CommuneCatalogueRoute />} />
          <Route path="cua" element={<CommuneCuaRoute />} />
          <Route path="cua/projects/:slug" element={<CommuneProjectRoute />} />
          <Route path="chat" element={<CommuneChatRoute />} />
          <Route path="reglements" element={<CommuneReglementsRoute />} />
        </Route>
        <Route path="*" element={<div>Page introuvable</div>} />
      </Routes>
    </AuthGate>
  );
}
