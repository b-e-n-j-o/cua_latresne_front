// components/carto/PLUConsultation.tsx
import React, { useState, useEffect } from 'react';
import { Box, Button, CircularProgress, Alert } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';

interface PLUConsultationProps {
  inseeCode: string | null;
  communeName: string | null;
  visible: boolean;
}

export const PLUConsultation: React.FC<PLUConsultationProps> = ({
  inseeCode,
  communeName,
  visible
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pluStatus, setPluStatus] = useState<'checking' | 'available' | 'unavailable' | null>(null);

  useEffect(() => {
    if (!inseeCode || !visible) {
      setPluStatus(null);
      return;
    }

    const checkAvailability = async () => {
      setPluStatus('checking');
      try {
        const apiBase = import.meta.env.VITE_API_BASE;
        const res = await fetch(`${apiBase}/api/plu/check/${inseeCode}`);
        const data = await res.json();
        setPluStatus(data.available ? 'available' : 'unavailable');
      } catch {
        setPluStatus('unavailable');
      }
    };

    checkAvailability();
  }, [inseeCode, visible]);

  const openPLU = async () => {
    if (!inseeCode) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const apiBase = import.meta.env.VITE_API_BASE;
      const response = await fetch(`${apiBase}/api/plu/reglement/${inseeCode}`);
      
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
        PLU - {communeName || inseeCode}
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
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <DescriptionIcon />}
          onClick={openPLU}
          disabled={loading}
          fullWidth
        >
          {loading ? 'Chargement...' : 'Consulter le règlement'}
        </Button>
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