import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainApp from "./routes/MainApp";
import MapsViewer from "./routes/MapsViewer";
import RedirectSlugPage from "./routes/RedirectSlugPage";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* 🔧 Page principale uniquement si on est exactement sur / */}
        <Route index element={<MainApp />} />

        {/* 🔗 Redirection courte */}
        <Route path="/m/:slug" element={<RedirectSlugPage />} />

        {/* 🗺️ Visualisation carte */}
        <Route path="/maps" element={<MapsViewer />} />

        {/* 🧭 Catch-all pour erreurs 404 éventuelles */}
        <Route path="*" element={<div>Page introuvable</div>} />
      </Routes>
    </Router>
  );
}
