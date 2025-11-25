import { useEffect, useState } from "react";
import supabase from "../supabaseClient";

export default function LogoutButton() {
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAuth(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setIsAuth(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isAuth) return null;

  return (
    <button
      onClick={() => supabase.auth.signOut()}
      className="rounded-md border px-3 py-1.5 text-sm shadow hover:bg-white"
      style={{ backgroundColor: "rgba(255,255,255,0.25)", borderColor: "rgba(0,0,0,0.05)", color: "#2E6E62", opacity: 0.8 }}
    >
      Se déconnecter
    </button>
  );
}
