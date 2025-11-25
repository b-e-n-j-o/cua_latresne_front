import React, { useState } from "react";
// Importez useNavigate et Link pour la navigation
import { useNavigate, Link } from "react-router-dom"; 
import supabase from "../supabaseClient";

/**
 * LoginForm : Gère la soumission du formulaire et la redirection après succès.
 */
export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  
  // Initialisation du hook de navigation
  const navigate = useNavigate(); 

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        throw error;
      }
      
      // ✅ SUCCÈS : Rediriger l'utilisateur vers la page principale (/app)
      navigate("/app", { replace: true }); 

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Email ou mot de passe invalide. Veuillez réessayer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 bg-white rounded-2xl border p-6 shadow-xl">
      <h2 className="text-xl font-bold text-center text-[#0B131F] mb-6">Portail CUA — Connexion</h2>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        {/* Champ Email */}
        <input
          type="email"
          placeholder="email@mairie.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 focus:border-[#2E6E62] focus:ring-1 focus:ring-[#2E6E62] outline-none"
          required
        />
        {/* Champ Mot de passe */}
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 focus:border-[#2E6E62] focus:ring-1 focus:ring-[#2E6E62] outline-none"
          required
        />
        
        {/* Affichage de l'erreur */}
        {error && <div className="text-sm text-red-600 border border-red-200 bg-red-50 p-3 rounded-xl">{error}</div>}
        
        {/* Bouton de Connexion */}
        <button
          disabled={busy}
          className="rounded-full px-4 py-3 text-base font-medium text-white transition-all duration-200 mt-2"
          style={{ 
            backgroundColor: "#0B131F", // Couleur de Kerelia
            opacity: busy ? 0.7 : 1,
            cursor: busy ? 'not-allowed' : 'pointer'
          }}
        >
          {busy ? "Connexion en cours..." : "Se connecter"}
        </button>
      </form>

      {/* Lien Mot de passe oublié */}
      <div className="mt-4 text-center">
        {/* ⬅️ LIEN VERS LA NOUVELLE PAGE DE DEMANDE DE RÉINITIALISATION */}
        <Link 
          to="/reset-password" 
          className="text-sm text-gray-600 hover:text-[#0B131F] transition-colors"
        >
          Mot de passe oublié ?
        </Link>
      </div>
    </div>
  );
}