import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { Navigate, type Session } from 'react-router-dom';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Vérifie si le token dans l’URL crée bien une session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session as unknown as Session | undefined);
      setLoading(false);
    });
  }, []);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMessage("Votre mot de passe a été mis à jour avec succès ! Redirection vers votre espace…");
      
      setTimeout(() => {
        window.location.href = '/app';
      }, 1500);

    } catch (err) {
      console.error("Erreur update password :", err);
      setError("Erreur lors de la mise à jour du mot de passe. Le lien peut être expiré.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 text-center text-gray-500">
        Vérification de la session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-red-50 rounded-2xl border border-red-200">
        <h2 className="text-xl font-bold text-red-700 mb-4">Lien invalide ou expiré</h2>
        <p className="text-red-600 mb-4">
          Ce lien de réinitialisation n'est pas valide ou a expiré. Veuillez refaire une demande.
        </p>
        <Navigate to="/reset-password" replace />
      </div>
    );
  }

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
          {loading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
        </button>
      </form>
    </div>
  );
}
