import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import MainApp from "./routes/MainApp";
import MapsViewer from "./routes/MapsViewer";
import RedirectSlugPage from "./routes/RedirectSlugPage";
import LandingPage from "./routes/LandingPage";
import ResourcesPage from "./routes/ResourcesPage";
import TestPage from "./routes/TestPage";
import LoginForm from "./auth/LoginForm";
import ResetPasswordPage from "./auth/ResetPasswordPage";
import UpdatePasswordPage from "./auth/UpdatePasswordPage";
import AuthGate from "./auth/AuthGate";
import supabase from "./supabaseClient";
import type { User } from "@supabase/supabase-js";

function PublicGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | undefined>(undefined);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? undefined);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return null;
  if (user) return <Navigate to="/app" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Pages publiques mais interdites aux utilisateurs connectés */}
      <Route path="/login" element={
        <PublicGate><LoginForm /></PublicGate>
      } />

      <Route path="/reset-password" element={
        <PublicGate><ResetPasswordPage /></PublicGate>
      } />

      <Route path="/update-password" element={
        <PublicGate><UpdatePasswordPage /></PublicGate>
      } />

      {/* Landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Pages publiques */}
      <Route path="/maps" element={<MapsViewer />} />
      <Route path="/m/:slug" element={<RedirectSlugPage />} />
      <Route path="/ressources" element={<ResourcesPage />} />
      <Route path="/test" element={<TestPage />} />

      {/* Pages protégées */}
      <Route
        path="/app"
        element={<AuthGate><MainApp /></AuthGate>}
      />

      {/* 404 */}
      <Route path="*" element={<div>Page introuvable</div>} />
    </Routes>
  );
}
