import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import supabase from "./supabaseClient";

export default function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"verify" | "form" | "done">("verify");

  useEffect(() => {
    async function verify() {
      if (!token) {
        setError("Lien invalide");
        return;
      }

      // Étape 1 : vérifier le token auprès de Supabase
      const response = await supabase.auth.verifyOtp({
        token_hash: token!,
        type: "recovery",
      });
      
      if (response.error) {
        setError("Lien expiré ou invalide");
        return;
      }
      

      if (error) {
        console.error(error);
        setError("Lien expiré ou invalide");
      } else {
        setStep("form");
      }
    }
    verify();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    if (password !== password2) {
      setError("Les mots de passe ne correspondent pas");
      setBusy(false);
      return;
    }

    // Étape 2 : définir le mot de passe
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    setStep("done");
    setBusy(false);
  }

  if (error) return <div className="p-4 text-red-600">{error}</div>;

  if (step === "verify")
    return <div className="p-6 text-gray-500">Vérification du lien…</div>;

  if (step === "done")
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold">Mot de passe mis à jour 🎉</h2>
        <button
          className="mt-4 rounded-full px-4 py-2 text-sm text-white"
          style={{ backgroundColor: "#2E6E62" }}
          onClick={() => navigate("/app")}
        >
          Se connecter
        </button>
      </div>
    );

  return (
    <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl border p-6">
      <h2 className="text-lg font-semibold">Définir votre mot de passe</h2>

      <form onSubmit={submit} className="mt-4 grid gap-3">
        <input
          type="password"
          placeholder="Nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Confirmez le mot de passe"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          className="w-full rounded-xl border px-3 py-2"
          required
        />

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button
          disabled={busy}
          className="rounded-full px-4 py-2 text-sm text-white"
          style={{ backgroundColor: "#2E6E62", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "…" : "Enregistrer le mot de passe"}
        </button>
      </form>
    </div>
  );
}
