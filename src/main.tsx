import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import HistoryPage from "./HistoryPanel";
import AuthGate from "./AuthGate";
import MapsViewer from "./routes/MapsViewer"; // 🆕 Import ici

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/maps" element={<MapsViewer />} /> {/* 🆕 ajout ici */}
        </Routes>
      </AuthGate>
    </BrowserRouter>
  </React.StrictMode>
);
