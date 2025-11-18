import { useRef, useState } from "react";

export function useCerfaWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [step, setStep] = useState(0);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "waiting_user" | "awaiting_pipeline" | "done" | "error">("idle");
  const [preanalyse, setPreanalyse] = useState<any>(null);
  const [cerfa, setCerfa] = useState<any>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);

  const start = (pdfBase64: string) => {
    const base = import.meta.env.VITE_API_BASE || "";
    const wsUrl = base.replace(/^https?/, (m: string) => m === "https" ? "wss" : "ws") + "/ws/pipeline";
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setStep(1);
      setStatus("running");
      setLabel("Pré-analyse du CERFA…");

      ws.current?.send(
        JSON.stringify({
          action: "start_preanalyse",
          pdf: pdfBase64,
        })
      );
    };

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.event === "progress") {
        setStep(msg.step);
        setLabel(msg.label);
      }

      if (msg.event === "preanalyse_result") {
        setPreanalyse(msg.preanalyse);
        setPdfPath(msg.pdf_path);
        setStatus("waiting_user");
        setLabel("En attente validation utilisateur");
      }

      if (msg.event === "cerfa_done") {
        setCerfa(msg.cerfa);
        setStep(0);
        setStatus("awaiting_pipeline");

        // Fermer la WebSocket pipeline
        if (ws.current) {
          ws.current.close();
          ws.current = null;
        }
      }
    };

    ws.current.onerror = (e) => {
      console.error("WebSocket error:", e);
      setStatus("error");
      setLabel("Erreur de connexion");
    };

    ws.current.onclose = () => {
      ws.current = null;
    };
  };

  const validatePreanalyse = (overrides: any) => {
    if (!ws.current || !pdfPath) return;

    setStatus("running");
    setStep(2);
    setLabel("Analyse complète du CERFA…");

    ws.current.send(
      JSON.stringify({
        action: "confirm_preanalyse",
        pdf_path: pdfPath,
        ...overrides,
      })
    );
  };

  return {
    step,
    status,
    label,
    preanalyse,
    cerfa,
    pdfPath,
    start,
    validatePreanalyse,
  };
}
