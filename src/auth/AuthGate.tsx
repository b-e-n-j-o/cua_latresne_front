import React, { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import supabase from "../supabaseClient";

/**
 * AuthGate — Composant de garde qui protège les routes.
 * Il vérifie si l'utilisateur est connecté et redirige vers /login 
 * si l'accès à une route protégée est tenté sans authentification.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    async function init() {
      // Vérifie l'état de la session Supabase
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    }
    init();

    // S'abonne aux changements d'état d'authentification en temps réel
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null);
    });
    
    // Nettoyage de l'abonnement
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // 1. Gérer l'état de chargement
  if (loading) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
            <div className="p-6 text-lg text-gray-500 font-medium">Chargement de la session...</div>
        </div>
      );
  }

  // 2. Autoriser l'accès aux routes explicitement non protégées (comme /maps)
  // Nous gardons cette vérification ici au cas où des sous-routes de /maps seraient enveloppées
  // dans ce garde, bien que le routeur principal les gère déjà souvent.
  if (location.pathname.startsWith("/maps")) {
    return <>{children}</>;
  }

  // 3. Utilisateur CONNECTÉ : Accès autorisé
  if (user) {
    return <>{children}</>;
  }

  // 4. Utilisateur NON CONNECTÉ et non sur la page de login : Redirection
  // Si l'utilisateur est sur la page /login, le routeur doit l'afficher directement
  // sans passer par AuthGate, mais nous gardons cette vérification pour éviter les boucles.
  if (location.pathname !== "/login") {
    // Redirige vers la page de connexion, remplaçant l'historique
    return <Navigate to="/login" replace />;
  }
  
  // Si l'utilisateur est sur /login et n'est pas connecté, et que la route est mal configurée, on ne rend rien.
  return null;
}