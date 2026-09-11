import { NavLink, Link } from "react-router-dom";
import { Activity, BookOpen } from "lucide-react";
import CommunePortalUserMenu from "../../layouts/CommunePortalUserMenu";
import "../../layouts/CommuneLayout.css";
import "./AdminLayout.css";

const NAV = [
  { to: "/admin", end: true, title: "Suivi CUA & chat", Icon: Activity },
  { to: "/admin/reglement", end: false, title: "Règlements", Icon: BookOpen },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="commune-portal" data-commune="admin">
      <nav className="commune-portal__nav" aria-label="Administration Kerelia">
        <Link to="/" className="commune-portal__logo" title="Kerelia" aria-label="Accueil Kerelia">
          <img src="/logo_kerelia_noir.png" alt="" width={32} height={32} />
        </Link>
        <div className="commune-portal__nav-tools">
          {NAV.map(({ to, end, title, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={title}
              className={({ isActive }) =>
                `commune-portal__nav-item${isActive ? " commune-portal__nav-item--active" : ""}`
              }
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden />
              <span className="commune-portal__nav-label">{title}</span>
            </NavLink>
          ))}
        </div>
        <CommunePortalUserMenu communeLabel="Admin" />
      </nav>
      <main className="admin-shell__content">{children}</main>
    </div>
  );
}
