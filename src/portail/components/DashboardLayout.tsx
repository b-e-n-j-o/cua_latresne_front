// src/portail/components/DashboardLayout.tsx
import { Building2, LayoutDashboard, Map, FolderKanban, Euro, FileText, ShoppingCart } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/portail" },
  { icon: Map, label: "Cartographie", path: "/portail/cartographie" },
  { icon: Map, label: "Urbanisme", path: "/portail/urbanisme" },
  { icon: Building2, label: "Patrimoine", path: "/portail/patrimoine" },
  { icon: Building2, label: "Parcelles", path: "/portail/parcelles" },
  { icon: FolderKanban, label: "Projets", path: "/portail/projets" },
  { icon: Euro, label: "Finances", path: "/portail/finances" },
  { icon: FileText, label: "Subventions", path: "/portail/subventions" },
  { icon: ShoppingCart, label: "Achats", path: "/portail/achats" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-400" />
            <span className="font-semibold text-lg">LATRESNE</span>
          </div>
        </div>
        
        <nav className="flex-1 p-3 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  isActive 
                    ? "bg-blue-600 text-white" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}