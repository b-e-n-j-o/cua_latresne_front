import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainApp from "./routes/MainApp";
import MapsViewer from "./routes/MapsViewer";
import RedirectSlugPage from "./routes/RedirectSlugPage"; // 👈 ajout

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/maps" element={<MapsViewer />} />
        <Route path="/m/:slug" element={<RedirectSlugPage />} /> {/* 👈 ajout */}
      </Routes>
    </Router>
  );
}
