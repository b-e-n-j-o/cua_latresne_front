import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";

import "./index.css";

// -------------------------------------------------------------
// ➡️ COMPOSANTS D'AUTHENTIFICATION (Imports nécessaires)
// Extensions retirées pour la résolution des modules standard.
import AuthGate from "./auth/AuthGate";
import LoginForm from "./auth/LoginForm"; 
import ResetPasswordPage from "./auth/ResetPasswordPage";
import UpdatePasswordPage from "./auth/UpdatePasswordPage";

// -------------------------------------------------------------

// ➡️ COMPOSANTS DE L'APPLICATION (Imports existants)
// Extensions retirées pour la résolution des modules standard.
import LandingPage from "./routes/LandingPage";
import MapsViewer from "./routes/MapsViewer";
import RedirectSlugPage from "./routes/RedirectSlugPage";
import MainApp from "./routes/MainApp";
import HistoryPanel from "./HistoryPanel";
import ResourcesPage from "./routes/ResourcesPage";
import AdminPage from "./routes/AdminPage";
import CuaViewer from "./routes/CuaViewer";
import TestPage from "./routes/TestPage";
import HomePage from "./routes/HomePage";
import TeamPage from "./pages/TeamPage";
import ChatUrba from "./routes/ChatUrba";
import MapPage from "./pages/BordeauxMetropoleMap";
import LatresneMap from "./pages/LatresneMap";
import CartoWorkspacePage from "./pages/CartoWorkspacePage";
import PortailApp from "./portail/PortailApp";
import LatresneCuaPage from "./pages/cua/LatresnePage";
import ProjectPage from "./pages/cua/ProjectPage";



// Wrapper pour HistoryPanel
const HistoryPage = () => (
  // La base API est passée via les variables d'environnement
  <HistoryPanel apiBase={import.meta.env.VITE_API_BASE || ""} />
);

// =========================================================================
// 🎯 DÉFINITION DES ROUTES PUBLIQUES
// =========================================================================
const PUBLIC_EXACT_ROUTES = [
  "/", 
  // ROUTES D'AUTHENTIFICATION (Doivent être publiques pour être accessibles)
  "/login",
  "/reset-password",
  "/update-password",
  
  "/maps",
  "/map", 
  "/ressources", 
  "/test",
  "/new",
  "/notre-equipe",
  "/chat-urba",
  "/latresne",
  "/carto",
];
const PUBLIC_PREFIX_ROUTES = ["/m/", "/maps", "/cua"];

function RouterWithAuthGate() {
  const location = useLocation();
  const path = location.pathname;

  const isExactPublic = PUBLIC_EXACT_ROUTES.includes(path);
  const isPrefixPublic = PUBLIC_PREFIX_ROUTES.some((prefix) =>
    path.startsWith(prefix)
  );

  const isPublic = isExactPublic || isPrefixPublic;

  // 1. Si la route est publique, on rend les routes sans AuthGate
  if (isPublic) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/new" element={<HomePage />} />
        {/* ROUTES D'AUTHENTIFICATION PUBLIQUES */}
        <Route path="/login" element={<LoginForm />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />

        {/* ➡️ AUTRES ROUTES PUBLIQUES */}
        <Route path="/notre-equipe" element={<TeamPage />} />
        <Route path="/maps" element={<MapsViewer />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/cua" element={<CuaViewer />} />
        <Route path="/ressources" element={<ResourcesPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/chat-urba" element={<ChatUrba />} />
        <Route path="/latresne" element={<LatresneMap />} />
        <Route path="/carto" element={<CartoWorkspacePage />} />
        <Route path="/m/:slug" element={<RedirectSlugPage />} />
        <Route path="*" element={<div>Page introuvable</div>} />
      </Routes>
    );
  }
  

  // 2. Si la route est protégée, on l'enveloppe dans AuthGate
  return (
    <AuthGate>
      <Routes>
        <Route path="/app" element={<MainApp />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/admin" element={<AdminPage />} />
        
        {/* 🆕 PORTAIL PROTÉGÉ */}
        <Route path="/portail/*" element={<PortailApp />} />
        
        {/* Redirige la racine vers /app (pour les utilisateurs connectés) */}
        <Route path="/" element={<Navigate to="/app" replace />} />

        <Route path="/latresne/cua" element={<LatresneCuaPage />} />
        <Route path="/latresne/cua/projects/:slug" element={<ProjectPage />} />

        <Route path="*" element={<div>Page introuvable</div>} />
      </Routes>
    </AuthGate>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RouterWithAuthGate />
    </BrowserRouter>
  </React.StrictMode>
);