import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Building2, AlertCircle, Star, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { getParcellesFromAirtable } from "../lib/airtable/parcelles";

export default function Parcelles() {
  const [parcelles, setParcelles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getParcellesFromAirtable();
        setParcelles(data);
      } catch (err) {
        setError("Erreur de synchronisation Airtable.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredParcelles = useMemo(() => {
    return parcelles.filter(p => 
      p.idParcelle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.etablissement.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [parcelles, searchQuery]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patrimoine Immobilier</h1>
          <p className="text-muted-foreground">Inventaire complet basé sur les 16 indicateurs Airtable</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" /> Nouvelle Entrée
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Liste des biens</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[150px]">ID Parcelle</TableHead>
                  <TableHead>Établissement / Rue</TableHead>
                  <TableHead>Surface</TableHead>
                  <TableHead>Zonages (PLU/PPRI)</TableHead>
                  <TableHead>Note Projet</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10">Chargement des données...</TableCell></TableRow>
                ) : filteredParcelles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-bold">{p.idParcelle}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.etablissement}</span>
                        <span className="text-xs text-muted-foreground">{p.rue}</span>
                      </div>
                    </TableCell>
                    <TableCell>{p.surface}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {p.zonePLU.map((z: string) => <Badge key={z} variant="outline" className="text-[10px] bg-blue-50">PLU: {z}</Badge>)}
                        {p.ppri.map((z: string) => <Badge key={z} variant="outline" className="text-[10px] bg-red-50 text-red-700">PPRI: {z}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-amber-500">
                        {p.noteProjet} <Star className="h-3 w-3 fill-current" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="whitespace-nowrap">{p.statutProjet}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/portail/parcelles/${p.id}`}>
                        <Button variant="outline" size="sm">Consulter</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}