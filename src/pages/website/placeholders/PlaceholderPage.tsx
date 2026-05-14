// pages/website/placeholders/PlaceholderPage.tsx
// Page générique placeholder en attendant le vrai contenu
// Chaque sous-page importe ce composant avec ses propres props

import type { ReactNode } from "react";

type PlaceholderPageProps = {
  section: string;   // ex: "Environnement"
  title: string;     // ex: "Scoring compensation écologique"
  description?: string;
  children?: ReactNode;
};

export function PlaceholderPage({ section, title, description, children }: PlaceholderPageProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0e0e0c",
        color: "#fff",
        fontFamily: "var(--font-sans, sans-serif)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header minimal avec retour */}
      <div
        style={{
          padding: "24px 40px",
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
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← KERELIA
        </a>
        <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>·</span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, letterSpacing: "0.06em" }}>
          {section.toUpperCase()}
        </span>
      </div>

      {/* Contenu centré */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 40px",
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
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
            marginBottom: 24,
          }}
        >
          EN COURS DE CONSTRUCTION
        </span>

        <h1
          style={{
            fontSize: "clamp(28px, 4vw, 48px)",
            fontWeight: 400,
            lineHeight: 1.15,
            margin: "0 0 20px",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>

        {description && (
          <p
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.7,
              margin: "0 0 40px",
              maxWidth: 560,
            }}
          >
            {description}
          </p>
        )}

        {children}

        <a
          href="/#contact"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 40,
            padding: "11px 22px",
            background: "#EFD57A",
            color: "#0e0e0c",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.04em",
            textDecoration: "none",
          }}
        >
          Nous contacter →
        </a>
      </div>
    </div>
  );
}

// ─── Pages individuelles ───────────────────────────────────────────────────────

// URBANISME
export function CertificatsUrbanismePage() {
  return (
    <PlaceholderPage
      section="Urbanisme"
      title="Certificats d'urbanisme"
      description="Analyse automatisée des certificats d'urbanisme opérationnels et d'information. Croisement réglementaire multi-couches, génération de rapports PDF structurés."
    />
  );
}

export function CarteIdentiteFoncierePage() {
  return (
    <PlaceholderPage
      section="Urbanisme"
      title="Carte d'identité foncière"
      description="Profil complet d'une parcelle : PLU, servitudes, topographie, historique foncier, données de marché DVF. Un document de référence pour vos études de faisabilité."
    />
  );
}

export function VeilleReglementairePage() {
  return (
    <PlaceholderPage
      section="Urbanisme"
      title="Veille réglementaire"
      description="Surveillance automatisée des publications RAA et JORF. Détection des modifications de documents d'urbanisme impactant vos zones d'intérêt, avec alertes Slack."
    />
  );
}

// ENVIRONNEMENT
export function ScoringCompensationPage() {
  return (
    <PlaceholderPage
      section="Environnement"
      title="Scoring compensation écologique"
      description="Évaluation multi-critères de la dureté foncière sur vos zones de compensation. Scoring déterministe + narration LLM, export PDF par parcelle."
    />
  );
}

export function EtudesEnvironnementalesPage() {
  return (
    <PlaceholderPage
      section="Environnement"
      title="Études environnementales automatisées"
      description="Pré-études foncières, analyse hydrologique des bassins versants, cartographie des contraintes environnementales. Rapports générés automatiquement à partir des données IGN et CEREMA."
    />
  );
}

export function BancarisationSuiviERCPage() {
  return (
    <PlaceholderPage
      section="Environnement"
      title="Bancarisation & suivi ERC"
      description="Plateforme de suivi des engagements Éviter-Réduire-Compenser. Tableau de bord technique et financier, module de supervision DREAL, traçabilité des mesures compensatoires."
    />
  );
}

// OUTILS / DATA SIG
export function OutilsPilotageSIGPage() {
  return (
    <PlaceholderPage
      section="Outils / Data SIG"
      title="Outils de pilotage SIG"
      description="Interface cartographique de pilotage de vos projets géospatiaux. Filtrage spatial, scoring foncier, couches thématiques à la demande."
    />
  );
}

export function BaseDonneesSIGPage() {
  return (
    <PlaceholderPage
      section="Outils / Data SIG"
      title="Base de données SIG"
      description="Infrastructure PostGIS centralisée. Intégration des référentiels IGN, cadastre, PLU, DVF, RPGSIG. Accès API standardisé pour vos outils métier."
    />
  );
}

export function VisualisationMNTLiDARPage() {
  return (
    <PlaceholderPage
      section="Outils / Data SIG"
      title="Visualisation MNT / LiDAR"
      description="Rendu 3D interactif des données LiDAR HD IGN et modèles numériques de terrain. Analyse de canopée, profils altimétriques, export GeoTIFF."
    />
  );
}