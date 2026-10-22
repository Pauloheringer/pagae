import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { analyzeDocument } from '@/functions/analyzeDocument';
import { FileText, Sparkles, Check, X, Loader2 } from 'lucide-react';

export default function DocumentPhotoUpload({ label, onExtracted }) {
  const [fileUri, setFileUri] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [error, setError] = useState('');

  const handleFile = async (f) => {
    if (!f) return;
    setError('');
    setUploading(true);
    setFileName(f.name);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: f });
      setFileUri(file_uri);
      setUploading(false);
      setAnalyzing(true);
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });
      const result = await analyzeDocument({ file_url: signed_url });
      const dados = result.data?.dados || result.data;
      setAiData(dados);
      onExtracted(dados, file_uri);
    } catch (e) {
      setError('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handleRemove = () => {
    setFileUri(''); setFileName(''); setAiData(null); setError('');
    onExtracted(null, '');
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">{label}</label>

      {!fileUri && !uploading && !analyzing && (
        <label className="block border-2 border-dashed border-border rounded-md p-3 text-center cursor-pointer hover:border-primary/50 transition-colors">
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          <FileText className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-foreground font-medium">Anexar (opcional)</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">IA extrai nome, CPF, nascimento e endereço</p>
        </label>
      )}

      {(uploading || analyzing) && (
        <div className="flex items-center justify-center gap-2 py-3 border border-border rounded-md">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">{analyzing ? 'IA lendo documento...' : 'Enviando...'}</span>
        </div>
      )}

      {fileUri && !analyzing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-green-500/5 border border-green-500/20 rounded-md px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Check className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-xs text-foreground truncate">{fileName}</span>
            </div>
            <button onClick={handleRemove} className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-4 h-4" /></button>
          </div>
          {aiData && (aiData.nome_completo || aiData.cpf || aiData.endereco) && (
            <div className="bg-background border border-border rounded-md p-2.5 space-y-0.5 text-xs">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-[10px] uppercase tracking-widest text-primary font-mono font-bold">IA extraiu:</span>
              </div>
              {aiData.nome_completo && <div className="flex justify-between gap-2"><span className="text-muted-foreground shrink-0">Nome</span><span className="font-medium text-foreground text-right">{aiData.nome_completo}</span></div>}
              {aiData.cpf && <div className="flex justify-between gap-2"><span className="text-muted-foreground shrink-0">CPF</span><span className="font-mono font-bold text-foreground">{aiData.cpf}</span></div>}
              {aiData.data_nascimento && <div className="flex justify-between gap-2"><span className="text-muted-foreground shrink-0">Nascimento</span><span className="font-medium text-foreground">{aiData.data_nascimento}</span></div>}
              {aiData.endereco && <div className="flex justify-between gap-2"><span className="text-muted-foreground shrink-0">Endereço</span><span className="font-medium text-foreground text-right">{aiData.endereco}</span></div>}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
