import { Routes, Route } from "react-router-dom";
import MainApp from "./routes/MainApp";
import MapsViewer from "./routes/MapsViewer";
import RedirectSlugPage from "./routes/RedirectSlugPage";

export default function App() {
  return (
    <Routes>
      <Route index element={<MainApp />} />
      <Route path="/maps" element={<MapsViewer />} />
      <Route path="/m/:slug" element={<RedirectSlugPage />} />
      <Route path="*" element={<div>Page introuvable</div>} />
    </Routes>
  );
}
