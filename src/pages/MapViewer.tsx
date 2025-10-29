import { useEffect, useState } from "react";

export default function MapsViewer() {
  const [urls, setUrls] = useState<{ id?: string; carte2d?: string; carte3d?: string }>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrls({
      id: params.get("id") || "Parcelle inconnue",
      carte2d: params.get("carte2d") || undefined,
      carte3d: params.get("carte3d") || undefined,
    });
  }, []);

  // petite fonction utilitaire JS pour alterner les iframes
  const switchTab = (tab: "2d" | "3d") => {
    const iframe2d = document.getElementById("iframe2d") as HTMLIFrameElement;
    const iframe3d = document.getElementById("iframe3d") as HTMLIFrameElement;
    const tab2d = document.getElementById("tab2d") as HTMLButtonElement;
    const tab3d = document.getElementById("tab3d") as HTMLButtonElement;

    if (iframe2d && iframe3d && tab2d && tab3d) {
      iframe2d.style.display = tab === "2d" ? "block" : "none";
      iframe3d.style.display = tab === "3d" ? "block" : "none";
      tab2d.style.background = tab === "2d" ? "#334155" : "#1e293b";
      tab3d.style.background = tab === "3d" ? "#334155" : "#1e293b";
    }
  };

  return (
    <div style={{ backgroundColor: "#0f172a", color: "white", minHeight: "100vh" }}>
      <header style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #334155" }}>
        <h2>Unité foncière {urls.id}</h2>
      </header>

      <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", padding: "1rem" }}>
        <button
          id="tab2d"
          style={{ background: "#334155", color: "white", border: "none", padding: "0.5rem 1rem" }}
          onClick={() => switchTab("2d")}
        >
          🗺️ Plan réglementaire 2D
        </button>
        <button
          id="tab3d"
          style={{ background: "#1e293b", color: "white", border: "none", padding: "0.5rem 1rem" }}
          onClick={() => switchTab("3d")}
        >
          ⛰️ Topographie 3D
        </button>
      </div>

      <div style={{ position: "relative", height: "80vh" }}>
        <iframe
          id="iframe2d"
          src={urls.carte2d || ""}
          title="Carte 2D"
          style={{ display: "block", width: "100%", height: "100%", border: "none" }}
        ></iframe>
        <iframe
          id="iframe3d"
          src={urls.carte3d || ""}
          title="Carte 3D"
          style={{ display: "none", width: "100%", height: "100%", border: "none" }}
        ></iframe>
      </div>
    </div>
  );
}
