import React, { useState } from "react";

export default function PreAnalyseCard({
  preanalyse,
  onValidate,
}: {
  preanalyse: any;
  onValidate: (override: { insee: string; parcelles: any[] }) => void;
}) {
  const [insee, setInsee] = useState(preanalyse.insee?.code || "");
  const [parcelles, setParcelles] = useState(
    preanalyse.parcelles || []
  );

  const updateParcelle = (index: number, field: string, value: string) => {
    const next = [...parcelles];
    next[index] = { ...next[index], [field]: value };
    setParcelles(next);
  };

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-4">Vérification des données détectées</h3>

      {/* INSEE */}
      <div className="mb-6">
        <label className="text-sm font-semibold text-[#0b131f]/80">
          Code INSEE détecté
        </label>
        <input
          value={insee}
          onChange={(e) => setInsee(e.target.value)}
          className="mt-2 w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30"
        />
      </div>

      {/* Parcelles */}
      <div className="mb-6">
        <label className="text-sm font-semibold text-[#0b131f]/80">
          Parcelles détectées
        </label>

        <div className="space-y-3 mt-3">
          {parcelles.map((p: any, i: number) => (
            <div key={i} className="flex gap-3">
              <input
                value={p.section}
                className="flex-1 px-3 py-2 rounded-lg bg-white/20 border border-white/30"
                onChange={(e) => updateParcelle(i, "section", e.target.value)}
              />
              <input
                value={p.numero}
                className="flex-1 px-3 py-2 rounded-lg bg-white/20 border border-white/30"
                onChange={(e) => updateParcelle(i, "numero", e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => onValidate({ insee, parcelles })}
        className="w-full mt-4 bg-[#ff4f3b] text-[#0b131f] py-3 rounded-xl font-semibold"
      >
        Confirmer et continuer
      </button>
    </div>
  );
}
