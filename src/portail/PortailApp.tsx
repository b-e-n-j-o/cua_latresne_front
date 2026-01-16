import { Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Cartographie from "./pages/Cartographie";
import Parcelles from "./pages/Parcelles";
import Patrimoine from "./pages/Patrimoine";
import Projets from "./pages/Projets";
import Finances from "./pages/Finances";
import Subventions from "./pages/Subventions";
import Urbanisme from "./pages/Urbanisme";
import Achats from "./pages/Achats";
import NotFound from "./pages/NotFound";

export default function PortailApp() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="home" element={<Home />} />
        <Route path="cartographie" element={<Cartographie />} />
        <Route path="parcelles" element={<Parcelles />} />
        <Route path="patrimoine" element={<Patrimoine />} />
        <Route path="projets" element={<Projets />} />
        <Route path="finances" element={<Finances />} />
        <Route path="subventions" element={<Subventions />} />
        <Route path="urbanisme" element={<Urbanisme />} />
        <Route path="achats" element={<Achats />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DashboardLayout>
  );
}