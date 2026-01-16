import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Plus, FolderKanban, Calendar } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

// Données mockées
const mockProjets = [
  {
    id: "1",
    nom: "Rénovation de la mairie",
    description: "Rénovation complète des façades et des espaces intérieurs de la mairie",
    typeProjet: "renovation",
    statut: "en_cours",
    budgetInitial: 250000,
    depensesReelles: 185000,
    pourcentageAvancement: 65,
    dateDebut: "2024-01-15",
    dateFinPrevue: "2024-09-30",
  },
  {
    id: "2",
    nom: "Construction d'une nouvelle école",
    description: "Construction d'un nouveau bâtiment scolaire avec 8 classes",
    typeProjet: "construction",
    statut: "planifie",
    budgetInitial: 1200000,
    depensesReelles: null,
    pourcentageAvancement: 0,
    dateDebut: "2025-03-01",
    dateFinPrevue: "2026-08-31",
  },
  {
    id: "3",
    nom: "Aménagement du parc municipal",
    description: "Création d'aires de jeux et réfection des allées",
    typeProjet: "amenagement",
    statut: "en_cours",
    budgetInitial: 85000,
    depensesReelles: 52000,
    pourcentageAvancement: 45,
    dateDebut: "2024-05-10",
    dateFinPrevue: "2024-10-15",
  },
  {
    id: "4",
    nom: "Rénovation des logements sociaux",
    description: "Isolation thermique et rénovation des installations",
    typeProjet: "renovation",
    statut: "termine",
    budgetInitial: 180000,
    depensesReelles: 175000,
    pourcentageAvancement: 100,
    dateDebut: "2023-09-01",
    dateFinPrevue: "2024-02-28",
  },
  {
    id: "5",
    nom: "Maintenance des équipements sportifs",
    description: "Entretien et remplacement des équipements du complexe sportif",
    typeProjet: "maintenance",
    statut: "en_cours",
    budgetInitial: 45000,
    depensesReelles: 32000,
    pourcentageAvancement: 70,
    dateDebut: "2024-06-01",
    dateFinPrevue: "2024-11-30",
  },
  {
    id: "6",
    nom: "Extension du parking",
    description: "Agrandissement du parking de la mairie avec 50 places supplémentaires",
    typeProjet: "amenagement",
    statut: "planifie",
    budgetInitial: 95000,
    depensesReelles: null,
    pourcentageAvancement: 0,
    dateDebut: "2025-01-15",
    dateFinPrevue: "2025-05-31",
  },
];

const typeProjetLabels: Record<string, string> = {
  construction: "Construction",
  renovation: "Rénovation",
  amenagement: "Aménagement",
  maintenance: "Maintenance",
};

const statutProjetLabels: Record<string, string> = {
  planifie: "Planifié",
  en_cours: "En cours",
  suspendu: "Suspendu",
  termine: "Terminé",
  annule: "Annulé",
};

const statutProjetColors: Record<string, string> = {
  planifie: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  en_cours: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  suspendu: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  termine: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  annule: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function Projets() {
  const [statutFilter, setStatutFilter] = useState<string>("all");

  const projets = mockProjets;
  const isLoading = false;

  const filteredProjets = useMemo(() => {
    if (!projets) return [];

    if (statutFilter === "all") return projets;

    return projets.filter((projet) => projet.statut === statutFilter);
  }, [projets, statutFilter]);

  const stats = useMemo(() => {
    if (!projets) return { total: 0, enCours: 0, planifies: 0, termines: 0 };

    return {
      total: projets.length,
      enCours: projets.filter((p) => p.statut === "en_cours").length,
      planifies: projets.filter((p) => p.statut === "planifie").length,
      termines: projets.filter((p) => p.statut === "termine").length,
    };
  }, [projets]);

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projets</h1>
            <p className="text-muted-foreground mt-2">
              Suivi des projets de construction, rénovation et aménagement
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau projet
          </Button>
        </div>

        {/* Statistiques */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total projets</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En cours</CardTitle>
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.enCours}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planifiés</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.planifies}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Terminés</CardTitle>
              <div className="h-4 w-4 rounded-full bg-gray-300"></div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.termines}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres */}
        <Card>
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
            <CardDescription>Filtrer les projets par statut</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(statutProjetLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Liste des projets */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : filteredProjets.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Aucun projet trouvé</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredProjets.map((projet) => (
              <Card key={projet.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-xl">{projet.nom}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {projet.description || "Aucune description"}
                      </CardDescription>
                    </div>
                    <Badge className={statutProjetColors[projet.statut]}>
                      {statutProjetLabels[projet.statut]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Avancement */}
                  {projet.statut === "en_cours" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Avancement</span>
                        <span className="font-medium">
                          {projet.pourcentageAvancement || 0}%
                        </span>
                      </div>
                      <Progress value={projet.pourcentageAvancement || 0} />
                    </div>
                  )}

                  {/* Informations */}
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Type</p>
                      <Badge variant="outline">{typeProjetLabels[projet.typeProjet]}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Budget initial</p>
                      <p className="font-medium">
                        {Number(projet.budgetInitial).toLocaleString("fr-FR")} €
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Dépenses réelles</p>
                      <p className="font-medium">
                        {projet.depensesReelles
                          ? `${Number(projet.depensesReelles).toLocaleString("fr-FR")} €`
                          : "-"}
                      </p>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Date de début</p>
                      <p className="font-medium">
                        {projet.dateDebut
                          ? new Date(projet.dateDebut).toLocaleDateString("fr-FR")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Date de fin prévue</p>
                      <p className="font-medium">
                        {projet.dateFinPrevue
                          ? new Date(projet.dateFinPrevue).toLocaleDateString("fr-FR")
                          : "-"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Link to={`/portail/projets/${projet.id}`}>
                      <Button variant="default" size="sm">
                        Voir détails
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm">
                      Modifier
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
