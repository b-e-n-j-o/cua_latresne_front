import Airtable from 'airtable';

// On utilise import.meta.env pour Vite
export const airtableBase = new Airtable({ 
  apiKey: import.meta.env.VITE_AIRTABLE_TOKEN 
}).base(import.meta.env.VITE_BASE_ID || '');