import { useEffect, useState } from "react";
import LogoutButton from "../auth/LogoutButton";
import supabase from "../supabaseClient";

type Props = {
  communeLabel: string;
};

export default function CommunePortalUserMenu({ communeLabel }: Props) {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const sync = (email: string | null) => setUserEmail(email);
    supabase.auth.getSession().then(({ data }) => {
      sync(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      sync(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const initials = communeLabel.slice(0, 2).toUpperCase();

  return (
    <div className="commune-portal__nav-footer">
      <button
        type="button"
        className="commune-portal__user-trigger"
        aria-label={`Compte — ${communeLabel}`}
      >
        <span className="commune-portal__commune-badge">{initials}</span>
        <div className="commune-portal__user-popover" role="tooltip">
          <span className="commune-portal__user-popover-commune">{communeLabel}</span>
          {userEmail ? (
            <span className="commune-portal__user-popover-email">{userEmail}</span>
          ) : (
            <span className="commune-portal__user-popover-email commune-portal__user-popover-email--muted">
              Non connecté
            </span>
          )}
          <div className="commune-portal__user-popover-logout">
            <LogoutButton />
          </div>
        </div>
      </button>
    </div>
  );
}
