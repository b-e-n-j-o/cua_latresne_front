import { FormEvent, useState } from "react";

const SUBJECT_OPTIONS = [
  { value: "urbanisme", label: "Urbanisme & documents d'urbanisme" },
  { value: "environnement", label: "Environnement & données" },
  { value: "sig", label: "Outils SIG / intégration" },
  { value: "autre", label: "Autre" },
] as const;

/**
 * Page publique « demande de démo » — formulaire visuel ; envoi réel à brancher plus tard.
 */
export default function DemoRequestPage() {
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNotice("Merci pour votre intérêt. L'envoi en ligne sera activé prochainement — en attendant, écrivez-nous à contact@kerelia.fr.");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0e0e0c",
        color: "#fff",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "24px max(24px, 5vw)",
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <a
          href="/"
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: 12,
            textDecoration: "none",
            letterSpacing: "0.08em",
          }}
        >
          ← KERELIA
        </a>
      </div>

      <div
        style={{
          flex: 1,
          maxWidth: 520,
          margin: "0 auto",
          width: "100%",
          padding: "56px max(24px, 5vw) 80px",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            display: "inline-block",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.12em",
            color: "#EFD57A",
            background: "rgba(239,213,122,0.08)",
            border: "0.5px solid rgba(239,213,122,0.2)",
            borderRadius: 4,
            padding: "3px 8px",
            marginBottom: 20,
          }}
        >
          FORMULAIRE — BIENTÔT ACTIF
        </span>

        <h1
          style={{
            fontSize: "clamp(26px, 5vw, 38px)",
            fontWeight: 500,
            lineHeight: 1.15,
            margin: "0 0 12px",
            letterSpacing: "-0.02em",
          }}
        >
          Demander une démonstration
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: "0 0 36px" }}>
          Décrivez votre besoin : nous reviendrons vers vous sous 48 h ouvrées. Les champs ci-dessous préfigurent le formulaire définitif.
        </p>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
            Adresse e-mail professionnelle
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="vous@organisation.fr"
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                fontSize: 15,
                outline: "none",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
            Type de sujet
            <select
              name="subject"
              required
              defaultValue=""
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                fontSize: 15,
                outline: "none",
              }}
            >
              <option value="" disabled>
                Choisir un type de sujet
              </option>
              {SUBJECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
            Présentation / contexte <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.35)" }}>(facultatif)</span>
            <textarea
              name="message"
              rows={4}
              placeholder="Projet, collectivité, volumétrie…"
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                fontSize: 15,
                outline: "none",
                resize: "vertical",
                minHeight: 100,
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              marginTop: 8,
              padding: "14px 22px",
              borderRadius: 8,
              border: "none",
              background: "#EFD57A",
              color: "#0e0e0c",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            Envoyer la demande
          </button>
        </form>

        {notice ? (
          <p
            role="status"
            style={{
              marginTop: 28,
              padding: "14px 16px",
              borderRadius: 8,
              background: "rgba(239,213,122,0.1)",
              border: "1px solid rgba(239,213,122,0.25)",
              color: "rgba(255,248,220,0.95)",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            {notice}
          </p>
        ) : null}

        <p style={{ marginTop: 40, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
          Déjà client ou partenaire ?{" "}
          <a href="/login" style={{ color: "#EFD57A", textDecoration: "none" }}>
            Identification
          </a>
        </p>
      </div>
    </div>
  );
}
