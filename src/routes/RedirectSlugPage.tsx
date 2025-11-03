import { useEffect } from "react";
import { useParams } from "react-router-dom";

export default function RedirectSlugPage() {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    async function fetchTarget() {
      if (!slug) return;

      try {
        const res = await fetch(
          `https://odlkagfeqkbrruajlcxm.supabase.co/rest/v1/shortlinks?slug=eq.${slug}`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ""}`,
            },
          }
        );

        const data = await res.json();
        if (data.length > 0) {
          const target = data[0].target_url;
          window.location.href = target;
        } else {
          document.body.innerHTML = "<h2>❌ Lien inconnu ou expiré</h2>";
        }
      } catch (err) {
        document.body.innerHTML = "<h2>⚠️ Erreur de redirection</h2>";
        console.error("Erreur lors de la redirection :", err);
      }
    }

    fetchTarget();
  }, [slug]);

  return (
    <div style={{ textAlign: "center", marginTop: "20%" }}>
      <h3>🔄 Redirection vers la carte interactive...</h3>
      <p>Merci de patienter quelques secondes.</p>
    </div>
  );
}
