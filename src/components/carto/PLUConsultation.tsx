// components/carto/PLUConsultation.tsx
import React, { useState, useEffect } from 'react';
import { Box, Button, CircularProgress, Alert } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import ChatIcon from '@mui/icons-material/Chat';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { ChatPLU } from './ChatPLU';

interface PLUConsultationProps {
  inseeCode: string | null;
  communeName: string | null;
  zones?: string[];
  visible: boolean;
}

export const PLUConsultation: React.FC<PLUConsultationProps> = ({
  inseeCode,
  communeName,
  zones,
  visible
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
  }, [inseeCode, visible, zones]);

  const openPLU = async () => {
    if (!inseeCode) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const apiBase = import.meta.env.VITE_API_BASE;
      
      // Si zones PLUI, utiliser la première zone
      let response;
      if (zones && zones.length > 0) {
        response = await fetch(`${apiBase}/api/plu/reglement/${inseeCode}/zone/${zones[0]}`);
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
    <Box
      sx={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        backgroundColor: 'white',
        padding: 2,
        borderRadius: 2,
        boxShadow: 3,
        minWidth: 250,
        zIndex: 1000
      }}
    >
      <h3 style={{ margin: '0 0 10px 0' }}>
        {pluInfo?.type || 'PLU'} - {pluInfo?.epciName || communeName || inseeCode}
        {pluInfo?.zone && ` - Zone ${pluInfo.zone}`}
      </h3>
      
      {error && (
        <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {pluStatus === 'checking' && (
        <Button disabled fullWidth variant="outlined">
          <CircularProgress size={20} sx={{ mr: 1 }} /> Vérification...
        </Button>
      )}

      {pluStatus === 'available' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <DescriptionIcon />}
            onClick={openPLU}
            disabled={loading}
            fullWidth
          >
            {loading ? 'Chargement...' : 'Consulter le règlement'}
          </Button>
          
          {(zones && zones.length > 0) && (
            <>
              <Button
                variant="outlined"
                startIcon={<ChatIcon />}
                endIcon={<AutoAwesomeIcon fontSize="small" />}
                onClick={() => setShowChat(!showChat)}
                fullWidth
              >
                {showChat ? 'Fermer le chat' : 'Poser une question'}
              </Button>
              
              {showChat && inseeCode && zones[0] && (
                <Box sx={{ mt: 2 }}>
                  <ChatPLU 
                    inseeCode={inseeCode} 
                    zone={zones[0]} 
                    commune={communeName || inseeCode}
                  />
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {pluStatus === 'unavailable' && (
        <Alert severity="info">
          Pas de PLU disponible pour {communeName || inseeCode}
        </Alert>
      )}
    </Box>
  );
};

export default PLUConsultation;