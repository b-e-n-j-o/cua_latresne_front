import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RAA_NAV_BADGE_ENABLED } from "./raaConfig";
import { countUnreadConcerne, type RaaItem } from "./raaShared";


const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

type RaaUnreadContextValue = {
  unreadRouge: number;
  refresh: () => Promise<void>;
};

const RaaUnreadContext = createContext<RaaUnreadContextValue>({
  unreadRouge: 0,
  refresh: async () => {},
});

export function useRaaUnread() {
  return useContext(RaaUnreadContext);
}

type ProviderProps = {
  communeSlug: string;
  enabled: boolean;
  children: ReactNode;
};

export function RaaUnreadProvider({ communeSlug, enabled, children }: ProviderProps) {
  const [unreadRouge, setUnreadRouge] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled || !RAA_NAV_BADGE_ENABLED) {
      setUnreadRouge(0);
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/${communeSlug}/raa`);
      if (!r.ok) return;
      const data = await r.json();
      const items: RaaItem[] = data.raa || [];
      setUnreadRouge(countUnreadConcerne(items));
    } catch {
      /* conserve le dernier compteur connu */
    }
  }, [communeSlug, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const value = useMemo(
    () => ({ unreadRouge, refresh }),
    [unreadRouge, refresh],
  );

  return <RaaUnreadContext.Provider value={value}>{children}</RaaUnreadContext.Provider>;
}
