import { airtableBase } from './client';

const TABLE_ID = import.meta.env.VITE_TABLE_ID || '';

export const getParcellesFromAirtable = async () => {
  try {
    const records = await airtableBase(TABLE_ID).select({ view: "Grid view" }).all();

    return records.map(record => ({
      id: record.id,
      // Mapping des 16 colonnes
      idParcelle: record.fields['ID Parcelle(s)'] || 'N/C',
      reglementationPLU: record.fields['Règlementation PLU'] || '',
      zonePLU: record.fields['Zone PLU'] || [], // Array
      servitudes: record.fields['Servitudes - Prescriptions - Informations'] || [], // Array
      cua: record.fields['CUA'] || [], // Array d'objets (pièces jointes)
      patrimoineNaturel: record.fields['Patrimoine naturel'] || [], // Array
      zaenr: record.fields['ZAEnR'] || '',
      aoc: record.fields['AOC'] || '',
      ppri: record.fields['Zonage PPRI'] || [], // Array
      pprmvt: record.fields['Zonage PPRMvT'] || [], // Array
      etablissement: record.fields['Etablissement'] || '-',
      surface: record.fields['Surface'] || '-',
      rue: record.fields['Rue'] || '-',
      noteProjet: record.fields['Valable pour un projet'] || 0, // Nombre
      typeProjet: record.fields['Type de projet'] || '',
      statutProjet: record.fields['Etablissements et "projets"'] || '-',
    }));
  } catch (error) {
    console.error("Erreur Airtable:", error);
    throw error;
  }
};