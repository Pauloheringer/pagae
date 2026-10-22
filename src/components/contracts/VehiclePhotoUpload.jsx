import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { analyzeVehicle } from '@/functions/analyzeVehicle';
import { Upload, Car, Sparkles, Check, X, Loader2 } from 'lucide-react';

export default function VehiclePhotoUpload({ label, onExtracted }) {
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
      const result = await analyzeVehicle({ file_url: signed_url });
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
        <label className="block border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors">
          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          <Car className="w-6 h-6 text-muted-foreground mx-auto mb-1.5" />
          <p className="text-xs text-foreground font-medium">Anexar foto (opcional)</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">IA identifica marca, modelo, cor e placa</p>
        </label>
      )}

      {(uploading || analyzing) && (
        <div className="flex items-center justify-center gap-2 py-3 border border-border rounded-md">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">{analyzing ? 'IA analisando foto...' : 'Enviando...'}</span>
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
          {aiData && (aiData.marca || aiData.modelo || aiData.placa) && (
            <div className="bg-background border border-border rounded-md p-2.5 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-[10px] uppercase tracking-widest text-primary font-mono font-bold">IA identificou:</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {aiData.marca && <div className="flex justify-between"><span className="text-muted-foreground">Marca</span><span className="font-medium text-foreground">{aiData.marca}</span></div>}
                {aiData.modelo && <div className="flex justify-between"><span className="text-muted-foreground">Modelo</span><span className="font-medium text-foreground">{aiData.modelo}</span></div>}
                {aiData.cor && <div className="flex justify-between"><span className="text-muted-foreground">Cor</span><span className="font-medium text-foreground">{aiData.cor}</span></div>}
                {aiData.placa && <div className="flex justify-between"><span className="text-muted-foreground">Placa</span><span className="font-mono font-bold text-foreground">{aiData.placa}</span></div>}
                {aiData.ano && <div className="flex justify-between"><span className="text-muted-foreground">Ano</span><span className="font-medium text-foreground">{aiData.ano}</span></div>}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
