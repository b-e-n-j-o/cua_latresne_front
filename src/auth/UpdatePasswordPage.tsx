import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { Navigate, type Session } from 'react-router-dom';

/**
 * Composant pour la mise à jour effective du mot de passe après validation du token.
 * Cette page est la destination de l'e-mail de réinitialisation.
 */
export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 1. Vérifier si l'utilisateur est bien "loggé" par le token dans l'URL
  useEffect(() => {
    // Le token de Supabase se trouve dans l'URL (hash #access_token=...)
    supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session as unknown as Session | undefined);
        setLoading(false);
    });
  }, []);

  // 2. Gérer la soumission du nouveau mot de passe
  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 6) { // Min. 6 caractères selon les paramètres Supabase par défaut
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // ⚠️ IMPORTANT : La session est déjà active grâce au token de l'URL.
      // On utilise updatePassword pour mettre à jour l'utilisateur de la session actuelle.
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage("✅ Votre mot de passe a été mis à jour avec succès ! Redirection vers la connexion...");
      // Rediriger vers la page de connexion après un court délai
      setTimeout(() => {
        window.location.href = '/login'; // Utiliser window.location.href pour recharger la page et effacer l'historique
      }, 2000);
    } catch (err) {
      console.error('Erreur de mise à jour:', err instanceof Error ? err.message : 'Erreur inconnue');
      setError("Erreur lors de la mise à jour du mot de passe. Le lien est peut-être expiré.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Rendu conditionnel
  if (loading) {
    return (
        <div className="max-w-md mx-auto mt-10 p-6 text-center text-gray-500">
            Vérification de la session...
        </div>
    );
  }

  // Si l'utilisateur n'a pas de session active (token expiré ou absent)
  if (!session) {
      return (
          <div className="max-w-md mx-auto mt-10 p-6 bg-red-50 rounded-2xl border border-red-200">
              <h2 className="text-xl font-bold text-red-700 mb-4">Lien Invalide ou Expiré</h2>
              <p className="text-red-600 mb-4">
                  Ce lien de réinitialisation n'est pas valide ou a expiré. Veuillez refaire une demande de réinitialisation.
              </p>
              <Navigate to="/reset-password" replace />
          </div>
      );
  }
  
  // Si la session est bonne, affiche le formulaire de mise à jour
  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow-2xl rounded-2xl border border-gray-100">
      <h2 className="text-xl font-bold text-center text-[#0B131F] mb-6">Définir un nouveau mot de passe</h2>

      {message && <div className="p-3 mb-4 text-sm font-medium text-green-700 bg-green-50 rounded-xl">{message}</div>}
      {error && <div className="p-3 mb-4 text-sm font-medium text-red-700 bg-red-50 rounded-xl">{error}</div>}

      <form onSubmit={handleUpdate} className="grid gap-4">
        <input
          type="password"
          placeholder="Nouveau mot de passe (min. 6 caractères)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 focus:border-[#2E6E62] focus:ring-1 focus:ring-[#2E6E62] outline-none"
          required
        />
        <input
          type="password"
          placeholder="Confirmer le nouveau mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
        </button>
      </form>
    </div>
  );
}