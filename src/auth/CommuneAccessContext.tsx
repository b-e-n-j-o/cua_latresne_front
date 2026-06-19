import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import supabase from "../supabaseClient";
import type { CommunePortalSlug } from "../layouts/communePortalConfig";
import { fetchCommuneAccess, type CommuneAccessSnapshot } from "./communeAccess";

type CommuneAccessContextValue = {
  loading: boolean;
  user: User | null;
  allowedSlugs: CommunePortalSlug[] | null;
  unrestricted: boolean;
  refresh: () => Promise<void>;
};

const CommuneAccessContext = createContext<CommuneAccessContextValue | null>(null);

const EMPTY_ACCESS: CommuneAccessSnapshot = {
  allowedSlugs: null,
  unrestricted: true,
};

export function CommuneAccessProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<CommuneAccessSnapshot>(EMPTY_ACCESS);
  const loadedUserIdRef = useRef<string | null>(null);

  const loadForUser = async (nextUser: User | null, options?: { silent?: boolean }) => {
    if (!nextUser) {
      loadedUserIdRef.current = null;
      setUser(null);
      setAccess(EMPTY_ACCESS);
      setLoading(false);
      return;
    }
    const sameUser = loadedUserIdRef.current === nextUser.id;
    const silent = options?.silent ?? sameUser;
    if (!silent) setLoading(true);
    loadedUserIdRef.current = nextUser.id;
    setUser(nextUser);
    const snapshot = await fetchCommuneAccess(nextUser);
    setAccess(snapshot);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      await loadForUser(data.session?.user ?? null);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      void loadForUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<CommuneAccessContextValue>(
    () => ({
      loading,
      user,
      allowedSlugs: access.allowedSlugs,
      unrestricted: access.unrestricted,
      refresh: async () => {
        const { data } = await supabase.auth.getSession();
        await loadForUser(data.session?.user ?? null, { silent: true });
      },
    }),
    [loading, user, access.allowedSlugs, access.unrestricted]
  );

  return (
    <CommuneAccessContext.Provider value={value}>{children}</CommuneAccessContext.Provider>
  );
}

export function useCommuneAccess(): CommuneAccessContextValue {
  const ctx = useContext(CommuneAccessContext);
  if (!ctx) {
    throw new Error("useCommuneAccess doit être utilisé dans CommuneAccessProvider");
  }
  return ctx;
}
