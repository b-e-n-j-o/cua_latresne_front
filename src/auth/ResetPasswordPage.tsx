import React, { useState } from 'react';
import supabase from '../supabaseClient';
import { Link } from 'react-router-dom';

/**
 * Composant pour demander un lien de réinitialisation de mot de passe.
 * L'utilisateur entre son e-mail, Supabase envoie le lien magique.
 */
export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      // ⚠️ IMPORTANT : Utiliser redirectTo pour pointer vers la page de mise à jour du mot de passe
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      setMessage(
        "Un e-mail de réinitialisation vous a été envoyé. Vérifiez votre boîte de réception et vos spams."
      );
      setEmail(''); // Effacer l'e-mail après l'envoi
    } catch (err) {
      console.error('Erreur de réinitialisation:', err instanceof Error ? err.message : 'Erreur inconnue');
      setError("Erreur : Impossible d'envoyer l'e-mail de réinitialisation. Vérifiez que l'adresse est valide.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow-2xl rounded-2xl border border-gray-100">
      <h2 className="text-xl font-bold text-center text-[#0B131F] mb-6">Mot de passe oublié ?</h2>
      
      <p className="text-sm text-gray-600 mb-4 text-center">
        Entrez l'adresse e-mail associée à votre compte pour recevoir un lien de réinitialisation.
      </p>

      {message && <div className="p-3 mb-4 text-sm font-medium text-green-700 bg-green-50 rounded-xl">{message}</div>}
      {error && <div className="p-3 mb-4 text-sm font-medium text-red-700 bg-red-50 rounded-xl">{error}</div>}

      <form onSubmit={handleReset} className="grid gap-4">
        <input
          type="email"
          placeholder="email@mairie.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 focus:border-[#2E6E62] focus:ring-1 focus:ring-[#2E6E62] outline-none"
          required
        />
        <button
          disabled={loading || !!message}
          className="rounded-full px-4 py-3 text-base font-medium text-white transition-all duration-200"
          style={{ 
            backgroundColor: "#0B131F",
            opacity: loading || message ? 0.7 : 1,
            cursor: loading || message ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link to="/login" className="text-sm text-[#2E6E62] hover:text-[#0B131F] transition-colors font-medium">
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  );
}