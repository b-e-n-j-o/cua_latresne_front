import { useEffect, useState } from "react";
import supabase from "../supabaseClient";
import { fetchCommuneAccess, resolveMonEspacePath } from "./communeAccess";

export type LandingSessionCTA = {
  loading: boolean;
  href: string;
  label: string;
  ariaLabel: string;
  variant: "login" | "mon-espace";
};

const LOGIN_CTA: LandingSessionCTA = {
  loading: false,
  href: "/login",
  label: "Se connecter",
  ariaLabel: "Se connecter",
  variant: "login",
};

export function useLandingSessionCTA(): LandingSessionCTA {
  const [cta, setCta] = useState<LandingSessionCTA>({ ...LOGIN_CTA, loading: true });

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const user = data.session?.user ?? null;
      if (!user) {
        setCta(LOGIN_CTA);
        return;
      }

      const access = await fetchCommuneAccess(user);
      const path = resolveMonEspacePath(access);
      if (!path) {
        setCta(LOGIN_CTA);
        return;
      }

      setCta({
        loading: false,
        href: path,
        label: "Mon espace",
        ariaLabel: "Accéder à mon espace",
        variant: "mon-espace",
      });
    }

    void refresh();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      void refresh();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return cta;
}
