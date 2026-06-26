import React, { useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../supabaseClient";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // Avec confirmation email activée : pas de session ici.
      // L'agent doit cliquer le lien reçu par mail avant de pouvoir se connecter.
      setDone(true);
    } catch (err: any) {
      console.error(err);
      // Le message du trigger « Domaine non autorisé… » remonte ici via err.message
      setError(traduireErreurSignup(err?.message));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl border p-6 shadow-xl text-center">
        <h2 className="text-xl font-bold text-[#0B131F] mb-3">Vérifiez votre boîte mail</h2>
        <p className="text-sm text-gray-600">
          Un lien de confirmation a été envoyé à <strong>{email}</strong>. Cliquez dessus
          pour activer votre compte, puis connectez-vous.
        </p>
        <Link to="/login" className="inline-block mt-5 text-sm text-[#0B131F] underline">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl border p-6 shadow-xl">
      <h2 className="text-xl font-bold text-center text-[#0B131F] mb-2">Portail CUA — Créer un compte</h2>
      <p className="text-center text-sm text-gray-500 mb-6">
        Utilisez votre adresse professionnelle de la collectivité.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <input
          type="email"
          placeholder="prenom.nom@ville-argelessurmer.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 focus:border-[#2E6E62] focus:ring-1 focus:ring-[#2E6E62] outline-none"
          required
        />
        <input
          type="password"
          placeholder="Choisissez un mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 focus:border-[#2E6E62] focus:ring-1 focus:ring-[#2E6E62] outline-none"
          minLength={8}
          required
        />
        {error && <div className="text-sm text-red-600 border border-red-200 bg-red-50 p-3 rounded-xl">{error}</div>}
        <button
          disabled={busy}
          className="rounded-full px-4 py-3 text-base font-medium text-white transition-all duration-200 mt-2"
          style={{ backgroundColor: "#0B131F", opacity: busy ? 0.7 : 1, cursor: busy ? "not-allowed" : "pointer" }}
        >
          {busy ? "Création en cours..." : "Créer mon compte"}
        </button>
      </form>
      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm text-gray-600 hover:text-[#0B131F] transition-colors">
          Déjà un compte ? Se connecter
        </Link>
      </div>
    </div>
  );
}

function traduireErreurSignup(raw?: string): string {
  if (!raw) return "Échec de la création du compte. Réessayez.";
  // Message remonté par ton trigger handle_new_user
  if (raw.toLowerCase().includes("domaine non autorisé")) {
    return "Cette adresse n'appartient pas à une collectivité autorisée. Contactez Kerelia.";
  }
  if (raw.toLowerCase().includes("already registered") || raw.toLowerCase().includes("already been registered")) {
    return "Un compte existe déjà avec cette adresse. Connectez-vous.";
  }
  return raw;
}