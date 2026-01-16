import { Card, CardContent } from "../components/ui/card";
import { FileText } from "lucide-react";

export default function Urbanisme() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Urbanisme</h1>
          <p className="text-muted-foreground mt-2">
            Dossiers d'urbanisme et intégration PLU/OAP
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4 py-12">
              <div className="h-16 w-16 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Module Urbanisme</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Le module d'urbanisme avec l'intégration des données PLU/OAP et le suivi des
                  dossiers sera disponible prochainement.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
