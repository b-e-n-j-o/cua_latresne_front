import { useEffect, useState } from "react";

export default function CuaViewer() {
  const [html, setHtml] = useState<string>("");
  const [toc, setToc] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------
  // Analyse du HTML → Sommaire
  // ---------------------------
  function buildToc(rawHtml: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    const headers = [...doc.querySelectorAll("h1, h2, h3")];

    const tocItems = headers.map((el, index) => {
      const text = el.textContent || "";
      const id = `section-${index}`;

      // Injecte un ID dans le HTML original
      el.setAttribute("id", id);

      return {
        id,
        text,
        level: Number(el.tagName.replace("H", "")),
      };
    });

    // Retourne le HTML modifié + la liste du sommaire
    return {
      htmlWithIds: doc.body.innerHTML,
      toc: tocItems,
    };
  }

  // ---------------------------
  // Chargement du CUA HTML
  // ---------------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");

    if (!t) {
      setError("Aucun token fourni.");
      return;
    }

    async function loadCUA() {
      try {
        const url = `${import.meta.env.VITE_API_BASE}/cua/html?t=${t}`;
        const res = await fetch(url);
        const data = await res.json();

        const { htmlWithIds, toc } = buildToc(data.html);
        setHtml(htmlWithIds);
        setToc(toc);
      } catch (e: any) {
        setError("Impossible de charger le document.");
      } finally {
        setLoading(false);
      }
    }

    loadCUA();
  }, []);

  if (error) {
    return <div style={{ textAlign: "center", marginTop: "10%" }}>{error}</div>;
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "10%" }}>
        Chargement du modèle de CUA…
      </div>
    );
  }

  // ---------------------------
  // Rendu
  // ---------------------------
  return (
    <div style={{ padding: "20px", maxWidth: 980, margin: "0 auto" }}>
      {/* Titre principal */}
      <h1
        style={{
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 10,
          color: "#0B131F",
          letterSpacing: "-0.5px",
        }}
      >
        Patron de Certificat d’Urbanisme — Kerelia
      </h1>

      <p style={{ textAlign: "center", color: "#444", marginBottom: 40 }}>
        Version de démonstration — Salon des Maires
      </p>

      {/* --------------------------- */}
      {/* SOMMAIRE INTERACTIF        */}
      {/* --------------------------- */}
      <div
        style={{
          background: "#E9F3FF",
          padding: "20px 25px",
          borderRadius: 10,
          marginBottom: 40,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            fontSize: 22,
            fontWeight: 600,
            color: "#0B131F",
          }}
        >
          Sommaire
        </h2>

        <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
          {toc.map((item) => (
            <li
              key={item.id}
              style={{
                marginLeft:
                  item.level === 1 ? 0 : item.level === 2 ? 15 : 30,
                marginBottom: 6,
              }}
            >
              <a
                href={`#${item.id}`}
                style={{
                  color: "#0B131F",
                  textDecoration: "none",
                  fontSize:
                    item.level === 1
                      ? "16px"
                      : item.level === 2
                      ? "15px"
                      : "14px",
                }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* --------------------------- */}
      {/* Styles Kerelia              */}
      {/* --------------------------- */}
      <style>
        {`
        html {
          scroll-behavior: smooth;
        }

        .cua-html {
          font-family: "Inter", sans-serif;
          line-height: 1.6;
          font-size: 15px;
          color: #1a1a1a;
        }

        .cua-html h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 40px 0 20px;
          text-align: center;
          color: #0B131F;
        }

        .cua-html h2 {
          font-size: 22px;
          margin: 30px 0 10px;
          font-weight: 600;
          color: #0B131F;
        }

        .cua-html h3 {
          font-size: 18px;
          margin: 25px 0 8px;
          font-weight: 600;
          color: #0B131F;
        }

        .cua-html p {
          margin: 10px 0;
          text-align: justify;
        }

        .cua-html img {
          display: block;
          margin: 20px auto;
          max-width: 350px;
        }

        .cua-html table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 14px;
        }

        .cua-html td, .cua-html th {
          border: 1px solid #ccc;
          padding: 8px 10px;
        }

        .cua-html th {
          background: #f5f7fa;
          font-weight: 600;
        }

        .cua-html ul {
          margin: 10px 0 10px 30px;
        }

        .cua-html hr {
          margin: 30px 0;
          border: none;
          border-top: 1px solid #ddd;
        }

        @media print {
          body {
            background: white !important;
          }
          .cua-html {
            padding: 0 !important;
            box-shadow: none !important;
          }
        }
      `}
      </style>

      {/* --------------------------- */}
      {/* CONTENU HTML DU CUA        */}
      {/* --------------------------- */}
      <div
        className="cua-html"
        style={{
          background: "white",
          padding: "40px",
          borderRadius: 16,
          boxShadow: "0 3px 12px rgba(0,0,0,0.08)",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
