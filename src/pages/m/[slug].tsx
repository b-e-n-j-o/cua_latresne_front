import { useParams } from "react-router-dom";
import { useEffect } from "react";

export default function RedirectPage() {
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
          console.error("Aucun lien trouvé pour ce slug.");
        }
      } catch (err) {
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
