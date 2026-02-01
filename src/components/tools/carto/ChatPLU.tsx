import { useState, useRef, useEffect } from "react";
import { 
  Box, 
  TextField, 
  Button, 
  Paper, 
  Typography, 
  CircularProgress,
  Alert
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// components/ChatPLU.tsx
interface ChatPLUProps {
  inseeCode: string;
  zone: string;  // "UP27"
  commune: string;
  parcelleContext: string; // Contexte parcellaire
}

export function ChatPLU({ inseeCode, zone, commune, parcelleContext }: ChatPLUProps) {
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll automatique vers le bas après nouveau message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);
    const currentInput = input;
    setInput("");
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/plu/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insee: inseeCode,
          zone: zone,
          question: currentInput,
          parcelle_context: parcelleContext,
          conversation_history: messages  // Contexte multi-turn
        })
      });
      
      if (!res.ok) {
        throw new Error("Erreur lors de la communication avec le serveur");
      }
      
      const data = await res.json();
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.answer 
      }]);
    } catch (err) {
      setError("Erreur lors de l'envoi de la question. Veuillez réessayer.");
      // Retirer le message utilisateur en cas d'erreur
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  if (!parcelleContext) {
    return (
      <Alert severity="warning">
        Veuillez sélectionner une parcelle et générer sa carte d'identité pour analyser le règlement.
      </Alert>
    );
  }

  return (
    <Paper 
      elevation={2}
      sx={{ 
        p: 2, 
        maxHeight: 400, 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#f5f5f5'
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
        💬 Chat PLU - Zone {zone} ({commune})
      </Typography>
      
      <Box 
        sx={{ 
          flex: 1, 
          overflowY: 'auto', 
          mb: 2,
          maxHeight: 250,
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}
      >
        {messages.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Posez une question sur le règlement du PLU...
          </Typography>
        )}
        {messages.map((msg, i) => (
          <Box
            key={i}
            sx={{
              p: 1.5,
              borderRadius: 1,
              backgroundColor: msg.role === 'user' ? '#e3f2fd' : 'white',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              boxShadow: 1
            }}
          >
            {msg.role === 'assistant' ? (
              <Box sx={{ 
                '& p': { margin: 0, marginBottom: 1 },
                '& p:last-child': { marginBottom: 0 },
                '& ul, & ol': { margin: 0, paddingLeft: 2 },
                '& strong': { fontWeight: 'bold' },
                '& em': { fontStyle: 'italic' }
              }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </Typography>
            )}
          </Box>
        ))}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Analyse du règlement...
            </Typography>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ex: Quelle hauteur maximale autorisée ?"
          disabled={loading}
          multiline
          maxRows={3}
        />
        <Button
          variant="contained"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
          sx={{ minWidth: 100 }}
        >
          Envoyer
        </Button>
      </Box>
    </Paper>
  );
}