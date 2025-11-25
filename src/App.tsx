import { Routes, Route, Navigate } from "react-router-dom";
import MainApp from "./routes/MainApp";
import MapsViewer from "./routes/MapsViewer";
import RedirectSlugPage from "./routes/RedirectSlugPage";
import LandingPage from "./routes/LandingPage";
import ResourcesPage from "./routes/ResourcesPage";
import TestPage from "./routes/TestPage";
import LoginForm from "./auth/LoginForm"; // Import nécessaire
import ResetPasswordPage from "./auth/ResetPasswordPage"; // ⬅️ NOUVEL IMPORT
import UpdatePasswordPage from "./auth/UpdatePasswordPage"; // ⬅️ NOUVEL IMPORT


export default function App() {
  return (
    <Routes>
      {/* ➡️ ROUTE PUBLIQUE DÉDIÉE À LA CONNEXION */}
      <Route path="/login" element={<LoginForm />} /> 
      
      {/* ➡️ ROUTES DE RÉINITIALISATION DE MOT DE PASSE */}
      <Route path="/reset-password" element={<ResetPasswordPage />} /> 
      <Route path="/update-password" element={<UpdatePasswordPage />} />
      
      {/* ➡️ ROUTES PUBLIQUES/LIEN DIRECT (sans AuthGate) */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/maps" element={<MapsViewer />} />
      <Route path="/m/:slug" element={<RedirectSlugPage />} />
      <Route path="/ressources" element={<ResourcesPage />} />
      <Route path="/test" element={<TestPage />} />
      
      {/* ➡️ ROUTE PROTÉGÉE : Utiliser AuthGate sur la MainApp (l'enveloppement est dans MainApp.jsx) */}
      <Route path="/app" element={<MainApp />} />
      
      {/* ➡️ Redirection par défaut de la racine vers /app (optionnel) */}
      <Route path="/" element={<Navigate to="/app" replace />} />

      {/* ➡️ ROUTE 404 */}
      <Route path="*" element={<div>Page introuvable</div>} />
    </Routes>
  );
}