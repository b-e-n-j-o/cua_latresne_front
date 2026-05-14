import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AuthGate from "./auth/AuthGate";
import LoginForm from "./auth/LoginForm";
import ResetPasswordPage from "./auth/ResetPasswordPage";
import UpdatePasswordPage from "./auth/UpdatePasswordPage";
import LandingPage from "./pages/website/landingpage/LandingPage";
import RedirectSlugPage from "./routes/RedirectSlugPage";
import HistoryPanel from "./HistoryPanel";
import AdminPage from "./routes/AdminPage";
import CuaViewer from "./routes/CuaViewer";
import ChatUrba from "./pages/chat-urba/ChatUrba";
import LidarViewerPage from "./pages/visualisations_de_test/lidar/LidarViewerPage";
import MntViewerPage from "./pages/visualisations_de_test/mnt/MntViewerPage";
import PortailApp from "./portail/PortailApp";
import LatresneCuaPage from "./pages/communes/latresne/cua/LatresnePage";
import ArgelesCuaPage from "./pages/communes/argeles/cua/ArgelesPage";
import MiosCuaPage from "./pages/communes/mios/MiosPage";
import ProjectPage from "./pages/communes/latresne/cua/ProjectPage";
import MiosProjectPage from "./pages/communes/mios/ProjectPage";

const HistoryPage = () => (
  <HistoryPanel apiBase={import.meta.env.VITE_API_BASE || ""} />
);

const PUBLIC_EXACT_ROUTES = [
  "/",
  "/login",
  "/reset-password",
  "/update-password",
  "/notre-equipe",
  "/chat-urba",
  "/latresne",
  "/lidar",
  "/mnt",
  "/carto",
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
        <Route path="/login" element={<LoginForm />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        <Route path="/notre-equipe" element={<Navigate to={{ pathname: "/", hash: "equipe" }} replace />} />
        <Route path="/cua" element={<CuaViewer />} />
        <Route path="/chat-urba" element={<ChatUrba />} />
        <Route path="/latresne" element={<div>Page introuvable</div>} />
        <Route path="/lidar" element={<LidarViewerPage />} />
        <Route path="/mnt" element={<MntViewerPage />} />
        <Route path="/carto" element={<div>Page introuvable</div>} />
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
        <Route path="/portail/*" element={<PortailApp />} />
        <Route path="/latresne/cua" element={<LatresneCuaPage />} />
        <Route path="/argeles/cua" element={<ArgelesCuaPage />} />
        <Route path="/mios/cua" element={<MiosCuaPage />} />
        <Route path="/latresne/cua/projects/:slug" element={<ProjectPage />} />
        <Route path="/mios/cua/projects/:slug" element={<MiosProjectPage />} />
        <Route path="*" element={<div>Page introuvable</div>} />
      </Routes>
    </AuthGate>
  );
}
