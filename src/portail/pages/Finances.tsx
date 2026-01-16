import { Card, CardContent } from "../components/ui/card";
import { Euro } from "lucide-react";

export default function Finances() {
  return (
    <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finances</h1>
          <p className="text-muted-foreground mt-2">
            Comptabilité analytique et suivi budgétaire
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4 py-12">
              <div className="h-16 w-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <Euro className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Module Finances</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Le module de comptabilité analytique sera disponible prochainement avec le suivi
                  des coûts et recettes par parcelle, les budgets prévisionnels et les tableaux de
                  bord financiers.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
