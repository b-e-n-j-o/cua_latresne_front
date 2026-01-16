import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function Achats() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Achats</h1>
          <p className="text-muted-foreground mt-2">
            Mutualisation des achats et suivi des ressources pour le bon fonctionnement de la commune
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Module Achats
            </CardTitle>
            <CardDescription>
              Gestion centralisée des achats et des ressources communales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center space-y-2">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground font-medium">Module en développement</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Ce module permettra de mutualiser les achats, suivre les fournisseurs, gérer les
                  contrats et optimiser les dépenses de la commune
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
