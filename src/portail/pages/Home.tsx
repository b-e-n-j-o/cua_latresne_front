import { Button } from "../components/ui/button";
import { Building2, Map, FolderKanban, Euro, TrendingUp, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Plateforme Patrimoniale</span>
          </div>
          <Link to="/portail/dashboard">
            <Button>Accéder à la plateforme</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Gestion patrimoniale intelligente pour les collectivités
            </h1>
            <p className="text-xl text-muted-foreground">
              Une plateforme complète pour piloter, optimiser et valoriser le patrimoine immobilier
              de votre commune avec des outils de cartographie, de suivi financier et de gestion de
              projets.
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <Link to="/portail/dashboard">
                <Button size="lg">Accéder à la plateforme</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Fonctionnalités principales</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Des outils professionnels pour une gestion patrimoniale efficace et transparente
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Map className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Cartographie interactive</h3>
              <p className="text-muted-foreground">
                Visualisez l'ensemble de votre patrimoine sur une carte interactive. Accédez
                instantanément aux informations détaillées de chaque parcelle.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Euro className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Comptabilité analytique</h3>
              <p className="text-muted-foreground">
                Suivez en temps réel tous les coûts et recettes par parcelle. Comparez les budgets
                prévisionnels aux dépenses réelles.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <FolderKanban className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Gestion de projets</h3>
              <p className="text-muted-foreground">
                Pilotez vos projets de construction, rénovation et aménagement avec un suivi
                budgétaire et d'avancement détaillé.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Tableaux de bord exécutifs</h3>
              <p className="text-muted-foreground">
                Des vues personnalisées par rôle (DGS, Directeur Technique, Urbanisme) avec les KPI
                essentiels en temps réel.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Catalogue de subventions</h3>
              <p className="text-muted-foreground">
                Identifiez les aides disponibles, suivez vos demandes et optimisez vos recettes
                avec des alertes automatiques.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Conformité et audit</h3>
              <p className="text-muted-foreground">
                Traçabilité complète des modifications, gestion des droits par rôle et conformité
                RGPD garantie.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-bold">Prêt à optimiser la gestion de votre patrimoine ?</h2>
            <p className="text-xl text-muted-foreground">
              Rejoignez les collectivités qui font confiance à notre plateforme pour piloter leur
              patrimoine immobilier.
            </p>
            <Link to="/portail/dashboard">
              <Button size="lg">Commencer maintenant</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-semibold">Plateforme Patrimoniale</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Plateforme de Gestion Patrimoniale. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
