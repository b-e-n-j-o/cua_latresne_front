import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainApp from "./routes/MainApp";
import MapsViewer from "./routes/MapsViewer";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Portail Kerelia - nécessite login */}
        <Route path="/" element={<MainApp />} />

        {/* Nouvelle page publique */}
        <Route path="/maps" element={<MapsViewer />} />
      </Routes>
    </Router>
  );
}
