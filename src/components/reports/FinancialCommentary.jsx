import React, { useState } from 'react';
import { financialCommentary } from '@/functions/financialCommentary';
import { Sparkles, RefreshCw, Copy, Check } from 'lucide-react';

export default function FinancialCommentary({ period }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await financialCommentary({ period });
      setText(res.data?.comentario || '');
    } catch (e) {
      setError('Não foi possível gerar o comentário agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-card border border-border rounded-md p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Comentário Financeiro (IA)
        </h2>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-xs px-3 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? 'Analisando...' : text ? 'Gerar novamente' : 'Gerar comentário'}
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!text && !loading && !error && (
        <p className="text-xs text-muted-foreground">
          Gere uma análise automática do período: valores recebidos, inadimplência, pendências de conferência e recomendações práticas.
        </p>
      )}

      {loading && (
        <div className="space-y-2 py-1">
          {[92, 84, 88, 70].map((w, i) => (
            <div key={i} className="h-3 bg-secondary rounded animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {text && !loading && (
        <div className="space-y-3">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{text}</p>
          <button onClick={copy} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar comentário</>}
          </button>
        </div>
      )}
    </div>
  );
}
