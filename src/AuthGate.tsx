import React, { useEffect, useState } from "react";
import supabase from "./supabaseClient";

/**
 * AuthGate — bloque l'accès aux enfants tant que l'utilisateur n'est pas connecté.
 * Ultra simple : email + mot de passe (avec option création de compte).
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    }
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  if (loading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  if (user) {
    // plus d'entête "Connecté : …" ici ; on laisse le parent gérer l'UI
    return <>{children}</>;
  }
  return <LoginForm />;
}

function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
  
    async function submit(e: React.FormEvent) {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } catch (err: any) {
        setError(err.message || "Email ou mot de passe invalide");
      } finally {
        setBusy(false);
      }
    }
  
    return (
      <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl border p-6">
        <h2 className="text-lg font-semibold">Portail CUA — Connexion</h2>
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <input
            type="email"
            placeholder="email@mairie.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            required
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm text-white"
            style={{ backgroundColor: "#2E6E62", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "…" : "Se connecter"}
          </button>
        </form>
      </div>
    );
  }
  