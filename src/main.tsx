import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import "./index.css";

import LandingPage from "./routes/LandingPage";
import MapsViewer from "./routes/MapsViewer";
import RedirectSlugPage from "./routes/RedirectSlugPage";
import SetPasswordPage from "./SetPassword";
import MainApp from "./routes/MainApp";
import HistoryPanel from "./HistoryPanel";
import AuthGate from "./AuthGate";
import ResourcesPage from "./routes/ResourcesPage";


// Wrapper pour HistoryPanel
const HistoryPage = () => (
  <HistoryPanel apiBase={import.meta.env.VITE_API_BASE || ""} />
);

// ROUTES PUBLIQUES
const PUBLIC_EXACT_ROUTES = ["/", "/set-password", "/maps", "/ressources"];
const PUBLIC_PREFIX_ROUTES = ["/m/"];

function RouterWithAuthGate() {
  const location = useLocation();
  const path = location.pathname;

  // Vérifie si la route est publique exacte
  const isExactPublic = PUBLIC_EXACT_ROUTES.includes(path);

  // Vérifie si la route commence par un préfixe public
  const isPrefixPublic = PUBLIC_PREFIX_ROUTES.some((prefix) =>
    path.startsWith(prefix)
  );

  const isPublic = isExactPublic || isPrefixPublic;

  if (isPublic) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/maps" element={<MapsViewer />} />
        <Route path="/ressources" element={<ResourcesPage />} />
        <Route path="/m/:slug" element={<RedirectSlugPage />} />
        <Route path="*" element={<div>Page introuvable</div>} />
      </Routes>
    );
  }
  

  // Routes protégées
  return (
    <AuthGate>
      <Routes>
        <Route path="/app" element={<MainApp />} />
        <Route path="/history" element={<HistoryPage />} />
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
