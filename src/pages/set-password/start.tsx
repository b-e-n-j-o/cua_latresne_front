import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function SetPasswordStart() {
  const [params] = useSearchParams();
  const email = params.get("email");

  useEffect(() => {
    if (!email) return;

    async function go() {
      const res = await fetch("https://matinducoin-backend.onrender.com/auth/generate-reset-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.reset_url) {
        window.location.href = data.reset_url;
      } else {
        alert("Erreur : impossible de générer le lien de création de mot de passe.");
      }
    }

    go();
  }, [email]);

  return (
    <div style={{ padding: 40 }}>
      <h2>Redirection…</h2>
      <p>Nous préparons votre lien de création de mot de passe.</p>
    </div>
  );
}
