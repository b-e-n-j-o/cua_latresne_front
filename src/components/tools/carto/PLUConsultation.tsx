// components/carto/PLUConsultation.tsx
import React, { useState, useEffect } from 'react';
import { FileText, MessageCircle, Loader2, AlertCircle, X } from 'lucide-react';
import { ChatPLU } from './ChatPLU';

interface PLUConsultationProps {
  inseeCode: string | null;
  communeName: string | null;
  zones?: string[];
  visible: boolean;
  parcelleContext?: string | null;
  embedded?: boolean; // Si true, pas de positionnement absolu (pour sidebar)
}

export const PLUConsultation: React.FC<PLUConsultationProps> = ({
  inseeCode,
  communeName,
  zones,
  visible,
  parcelleContext,
  embedded = false
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pluStatus, setPluStatus] = useState<'checking' | 'available' | 'unavailable' | null>(null);
  const [pluInfo, setPluInfo] = useState<{type: string, epciName?: string, zone?: string} | null>(null);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (!inseeCode || !visible) {
      setPluStatus(null);
      setPluInfo(null);
      return;
    }

    const checkAvailability = async () => {
      setPluStatus('checking');
      try {
        const apiBase = import.meta.env.VITE_API_BASE;
        const zone = zones && zones.length > 0 ? zones[0] : undefined;
        const url = zone 
          ? `${apiBase}/api/plu/check/${inseeCode}?zone=${encodeURIComponent(zone)}`
          : `${apiBase}/api/plu/check/${inseeCode}`;
        const res = await fetch(url);
        const data = await res.json();
        setPluStatus(data.available ? 'available' : 'unavailable');
        if (data.available) {
          setPluInfo({
            type: data.type || 'PLU',
            epciName: data.epci_name,
            zone: data.zone
          });
        }
      } catch {
        setPluStatus('unavailable');
      }
    };

    checkAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inseeCode, visible, zones?.[0]]);

  const openPLU = async () => {
    if (!inseeCode) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const apiBase = import.meta.env.VITE_API_BASE;
      
      // Si zones PLUI, utiliser la première zone
      let response;
      if (zones && zones.length > 0) {
        const zoneEncoded = encodeURIComponent(zones[0]);
        response = await fetch(`${apiBase}/api/plu/reglement/${inseeCode}/zone/${zoneEncoded}`);
      } else {
        // PLU classique
        response = await fetch(`${apiBase}/api/plu/reglement/${inseeCode}`);
      }
      
      if (!response.ok) {
        setError("PLU non disponible pour cette commune");
        return;
      }
      
      const data = await response.json();
      window.open(data.url, '_blank');
      
    } catch (err) {
      setError("Erreur lors de la récupération du PLU");
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !inseeCode) return null;

  return (
    <div className={`${embedded ? '' : 'absolute bottom-5 left-4 z-40'} bg-white shadow-lg rounded-md p-4 ${embedded ? 'w-full' : 'w-64'}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-sm">
          {pluInfo?.type || 'PLU'} - {pluInfo?.epciName || communeName || inseeCode}
          {pluInfo?.zone && ` - Zone ${pluInfo.zone}`}
        </h3>
        {error && (
          <button
            onClick={() => setError(null)}
            className="text-gray-500 hover:text-gray-700 text-lg leading-none"
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      {error && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded p-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800">{error}</div>
          </div>
        </div>
      )}
      
      {pluStatus === 'checking' && (
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 bg-gray-300 text-gray-600 py-2 px-3 rounded text-sm cursor-not-allowed"
        >
          <Loader2 size={16} className="animate-spin" />
          <span>Vérification...</span>
        </button>
      )}

      {pluStatus === 'available' && (
        <div className="space-y-2">
          <button
            onClick={openPLU}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-2 px-3 rounded text-sm transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Chargement...</span>
              </>
            ) : (
              <>
                <FileText size={16} />
                <span>Consulter le règlement</span>
              </>
            )}
          </button>
          
          {(zones && zones.length > 0) && (
            <>
              <button
                onClick={() => setShowChat(!showChat)}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded text-sm transition-colors"
              >
                <MessageCircle size={16} />
                <span>{showChat ? 'Fermer le chat' : 'Poser une question'}</span>
              </button>
              
              {showChat && inseeCode && zones[0] && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <ChatPLU 
                    inseeCode={inseeCode} 
                    zone={zones[0]} 
                    commune={communeName || inseeCode}
                    parcelleContext={parcelleContext || ""}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {pluStatus === 'unavailable' && (
        <div className="bg-gray-50 border border-gray-200 rounded p-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-700">
              Pas de PLU disponible pour {communeName || inseeCode}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PLUConsultation;