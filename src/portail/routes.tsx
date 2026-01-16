import { Route } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Cartographie from "./pages/Cartographie";
import Parcelles from "./pages/Parcelles";
import Patrimoine from "./pages/Patrimoine";

export function PortailRoutes() {
  return (
    <>
      <Route path="/portail" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
      <Route path="/portail/cartographie" element={<DashboardLayout><Cartographie /></DashboardLayout>} />
      <Route path="/portail/parcelles" element={<DashboardLayout><Parcelles /></DashboardLayout>} />
      <Route path="/portail/patrimoine" element={<DashboardLayout><Patrimoine /></DashboardLayout>} />
    </>
  );
}