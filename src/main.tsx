import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import HistoryPanel from "./HistoryPanel";
import AuthGate from "./AuthGate";
import MapsViewer from "./routes/MapsViewer";
import RedirectSlugPage from "./routes/RedirectSlugPage";
import SetPasswordPage from "./SetPassword";

// Wrapper pour HistoryPanel avec les props nécessaires
const HistoryPage = () => (
  <HistoryPanel apiBase={import.meta.env.VITE_API_BASE || ""} />
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/maps" element={<MapsViewer />} />
          <Route path="/m/:slug" element={<RedirectSlugPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  </React.StrictMode>
);
