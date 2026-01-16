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
import { Badge } from "../components/ui/badge";
import { Search, Plus, MapPin, Building2 } from "lucide-react";
import { useMemo, useState } from "react";
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

const typeBienLabels: Record<string, string> = {
  ecole: "École",
  cimetiere: "Cimetière",
  terrain_vide: "Terrain vide",
  eglise: "Église",
  parking: "Parking",
  logement: "Logement",
  equipement_sportif: "Équipement sportif",
  mairie: "Mairie",
  bibliotheque: "Bibliothèque",
  creche: "Crèche",
  piscine: "Piscine",
  autre: "Autre",
};

const statutOccupationLabels: Record<string, string> = {
  habite: "Habité",
  loue: "Loué",
  vacant: "Vacant",
  en_projet: "En projet",
};

const statutOccupationColors: Record<string, string> = {
  habite: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  loue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  vacant: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  en_projet: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export default function Parcelles() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const parcelles = mockParcelles;
  const isLoading = false;

  const filteredParcelles = useMemo(() => {
    if (!parcelles) return [];

    return parcelles.filter((parcelle) => {
      const matchesSearch =
        searchQuery === "" ||
        parcelle.numeroCadastral.toLowerCase().includes(searchQuery.toLowerCase()) ||
        parcelle.adresse?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === "all" || parcelle.typeBien === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [parcelles, searchQuery, typeFilter]);

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Parcelles</h1>
            <p className="text-muted-foreground mt-2">
              Gestion de l'inventaire du patrimoine immobilier
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une parcelle
          </Button>
        </div>

        {/* Filtres */}
        <Card>
          <CardHeader>
            <CardTitle>Recherche et filtres</CardTitle>
            <CardDescription>Filtrez les parcelles par numéro cadastral, adresse ou type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
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
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Type de bien" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {Object.entries(typeBienLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Liste des parcelles */}
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredParcelles.length} parcelle{filteredParcelles.length > 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              {typeFilter !== "all"
                ? `Filtrées par type : ${typeBienLabels[typeFilter]}`
                : "Toutes les parcelles"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : filteredParcelles.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune parcelle trouvée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numéro cadastral</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Adresse</TableHead>
                      <TableHead>Surface</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParcelles.map((parcelle) => (
                      <TableRow key={parcelle.id}>
                        <TableCell className="font-medium">{parcelle.numeroCadastral}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{typeBienLabels[parcelle.typeBien]}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {parcelle.adresse || "-"}
                        </TableCell>
                        <TableCell>
                          {parcelle.surface ? `${Number(parcelle.surface).toFixed(0)} m²` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              statutOccupationColors[parcelle.statutOccupation || "vacant"]
                            }
                          >
                            {statutOccupationLabels[parcelle.statutOccupation || "vacant"]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to={`/portail/parcelles/${parcelle.id}`}>
                            <Button variant="ghost" size="sm">
                              Voir détails
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions rapides */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <Link to="/portail/cartographie">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Voir sur la carte</p>
                    <p className="text-sm text-muted-foreground">
                      Visualiser les parcelles sur la cartographie
                    </p>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Importer des données</p>
                  <p className="text-sm text-muted-foreground">
                    Importer depuis un fichier cadastral
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
