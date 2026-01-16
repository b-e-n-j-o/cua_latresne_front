import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Building2, FolderKanban, Euro, TrendingUp, AlertCircle } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

// Données mockées
const mockStats = {
  totalParcelles: 42,
  projetsEnCours: 8,
  totalProjets: 15,
  totalDepenses: 1250000,
  totalRecettes: 1450000,
  totalAides: 85000,
};

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const stats = mockStats;
  const isLoading = false;
  const error = null;

  const kpiCards = useMemo(() => {
    if (!stats) return [];

    return [
      {
        title: "Parcelles gérées",
        value: stats.totalParcelles.toString(),
        description: "Patrimoine total",
        icon: Building2,
        color: "text-blue-600",
        bgColor: "bg-blue-50 dark:bg-blue-950",
      },
      {
        title: "Projets en cours",
        value: `${stats.projetsEnCours} / ${stats.totalProjets}`,
        description: "Projets actifs",
        icon: FolderKanban,
        color: "text-amber-600",
        bgColor: "bg-amber-50 dark:bg-amber-950",
      },
      {
        title: "Dépenses totales",
        value: `${(stats.totalDepenses / 1000).toFixed(0)}k €`,
        description: `Année ${currentYear}`,
        icon: Euro,
        color: "text-red-600",
        bgColor: "bg-red-50 dark:bg-red-950",
      },
      {
        title: "Recettes totales",
        value: `${(stats.totalRecettes / 1000).toFixed(0)}k €`,
        description: `Année ${currentYear}`,
        icon: TrendingUp,
        color: "text-green-600",
        bgColor: "bg-green-50 dark:bg-green-950",
      },
    ];
  }, [stats, currentYear]);

  return (
    <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground mt-2">
            Vue d'ensemble de la gestion patrimoniale de la commune
          </p>
        </div>

        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-10 w-10 bg-muted rounded-lg"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-20 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-16"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">
                Erreur lors du chargement des statistiques
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.title} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${kpi.bgColor}`}>
                      <Icon className={`h-5 w-5 ${kpi.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpi.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Solde Net */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Solde net {currentYear}</CardTitle>
              <CardDescription>Différence entre recettes et dépenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-bold ${
                    stats.totalRecettes - stats.totalDepenses >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {((stats.totalRecettes - stats.totalDepenses) / 1000).toFixed(0)}k €
                </span>
                <span className="text-sm text-muted-foreground">
                  {stats.totalRecettes - stats.totalDepenses >= 0 ? "excédent" : "déficit"}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Recettes</span>
                  <span className="font-medium text-green-600">
                    +{(stats.totalRecettes / 1000).toFixed(0)}k €
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dépenses</span>
                  <span className="font-medium text-red-600">
                    -{(stats.totalDepenses / 1000).toFixed(0)}k €
                  </span>
                </div>
                {stats.totalAides > 0 && (
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Aides obtenues</span>
                    <span className="font-medium text-amber-600">
                      +{(stats.totalAides / 1000).toFixed(0)}k €
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
            <CardDescription>Accédez rapidement aux fonctionnalités principales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link to="/portail/cartographie">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Voir la carte</p>
                    <p className="text-xs text-muted-foreground">Cartographie interactive</p>
                  </div>
                </div>
              </Link>

              <Link to="/portail/projets">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <FolderKanban className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Gérer les projets</p>
                    <p className="text-xs text-muted-foreground">Suivi et planification</p>
                  </div>
                </div>
              </Link>

              <Link to="/portail/finances">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Euro className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Consulter les finances</p>
                    <p className="text-xs text-muted-foreground">Coûts et recettes</p>
                  </div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Informations système */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Plateforme de Gestion Patrimoniale • Version 1.0 • Données mises à jour en temps réel
            </p>
          </CardContent>
        </Card>
      </div>
  );
}
