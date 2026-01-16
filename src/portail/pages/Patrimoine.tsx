import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Building2, Search, Plus, MapPin } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

// Données mockées
const mockParcelles = [
  {
    id: "1",
    numeroCadastral: "000 AB 001",
    typeBien: "mairie",
    adresse: "1 Place de la Mairie",
    surface: 850,
    statutOccupation: "habite",
  },
  {
    id: "2",
    numeroCadastral: "000 AB 002",
    typeBien: "ecole",
    adresse: "15 Rue de l'École",
    surface: 1200,
    statutOccupation: "habite",
  },
  {
    id: "3",
    numeroCadastral: "000 AB 003",
    typeBien: "cimetiere",
    adresse: "Chemin du Cimetière",
    surface: 2500,
    statutOccupation: "vacant",
  },
  {
    id: "4",
    numeroCadastral: "000 AB 004",
    typeBien: "parking",
    adresse: "Place du Marché",
    surface: 600,
    statutOccupation: "vacant",
  },
  {
    id: "5",
    numeroCadastral: "000 AB 005",
    typeBien: "bibliotheque",
    adresse: "8 Rue de la Culture",
    surface: 450,
    statutOccupation: "habite",
  },
  {
    id: "6",
    numeroCadastral: "000 AB 006",
    typeBien: "terrain_vide",
    adresse: "Zone industrielle",
    surface: 3500,
    statutOccupation: "en_projet",
  },
  {
    id: "7",
    numeroCadastral: "000 AB 007",
    typeBien: "logement",
    adresse: "12 Rue des Logements",
    surface: 75,
    statutOccupation: "loue",
  },
  {
    id: "8",
    numeroCadastral: "000 AB 008",
    typeBien: "equipement_sportif",
    adresse: "Complexe sportif",
    surface: 1800,
    statutOccupation: "habite",
  },
];

export default function Patrimoine() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("tous");

  const parcelles = mockParcelles;
  const isLoading = false;

  const filteredParcelles = parcelles?.filter((p) => {
    const matchesSearch =
      searchQuery === "" ||
      p.numeroCadastral.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.adresse?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === "tous" || p.typeBien === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Patrimoine</h1>
            <p className="text-muted-foreground mt-2">
              Gestion du patrimoine communal avec carte interactive et suivi des coûts
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une parcelle
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Recherche et filtres</CardTitle>
            <CardDescription>
              Filtrez les parcelles par numéro cadastral, adresse ou type de bien
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par numéro cadastral ou adresse..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Type de bien" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les types</SelectItem>
                  <SelectItem value="ecole">École</SelectItem>
                  <SelectItem value="cimetiere">Cimetière</SelectItem>
                  <SelectItem value="terrain_vide">Terrain vide</SelectItem>
                  <SelectItem value="eglise">Église</SelectItem>
                  <SelectItem value="parking">Parking</SelectItem>
                  <SelectItem value="logement">Logement</SelectItem>
                  <SelectItem value="equipement_sportif">Équipement sportif</SelectItem>
                  <SelectItem value="mairie">Mairie</SelectItem>
                  <SelectItem value="bibliotheque">Bibliothèque</SelectItem>
                  <SelectItem value="creche">Crèche</SelectItem>
                  <SelectItem value="piscine">Piscine</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Carte interactive - Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Carte interactive du patrimoine
            </CardTitle>
            <CardDescription>
              Visualisez toutes les parcelles communales sur la carte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center space-y-2">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">
                  Carte interactive Google Maps à intégrer
                </p>
                <p className="text-sm text-muted-foreground">
                  Cliquez sur une parcelle pour afficher ses détails
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des parcelles */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des parcelles</CardTitle>
            <CardDescription>
              {filteredParcelles?.length || 0} parcelle(s) trouvée(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Chargement des parcelles...
              </div>
            ) : filteredParcelles && filteredParcelles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro cadastral</TableHead>
                    <TableHead>Adresse</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Surface</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParcelles.map((parcelle) => (
                    <TableRow key={parcelle.id}>
                      <TableCell className="font-medium">{parcelle.numeroCadastral}</TableCell>
                      <TableCell>{parcelle.adresse || "—"}</TableCell>
                      <TableCell className="capitalize">
                        {parcelle.typeBien.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>{parcelle.surface || "—"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            parcelle.statutOccupation === "vacant"
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : parcelle.statutOccupation === "loue"
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : parcelle.statutOccupation === "en_projet"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {parcelle.statutOccupation?.replace(/_/g, " ") || "Non défini"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/portail/patrimoine/${parcelle.id}`}>
                          <Button variant="ghost" size="sm">
                            Détails
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune parcelle trouvée</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ajoutez votre première parcelle pour commencer
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
