import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { analyzeContract } from '@/functions/analyzeContract';
import { formatCurrency } from '@/lib/format';
import { Upload, FileText, Sparkles, Check, X, Loader2 } from 'lucide-react';

export default function ContractPhotoUpload({ onExtracted }) {
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

      // Create signed URL for AI analysis
      setAnalyzing(true);
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });
      const result = await analyzeContract({ file_url: signed_url });
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
    setFileUri('');
    setFileName('');
    setAiData(null);
    setError('');
    onExtracted(null, '');
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5 block">
        Foto ou PDF da Promissória / Contrato (IA extrai os dados automaticamente)
      </label>

      {!fileUri && !uploading && !analyzing && (
        <label className="block border-2 border-dashed border-border rounded-md p-5 text-center cursor-pointer hover:border-primary/50 transition-colors">
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium">Anexar foto ou PDF da promissória</p>
          <p className="text-xs text-muted-foreground mt-1">A IA lê o documento e preenche valor, parcelas, entrada, etc.</p>
        </label>
      )}

      {(uploading || analyzing) && (
        <div className="flex items-center justify-center gap-2 py-4 border border-border rounded-md">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">{analyzing ? 'IA lendo a promissória...' : 'Enviando foto...'}</span>
        </div>
      )}

      {fileUri && !analyzing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-green-500/5 border border-green-500/20 rounded-md px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Check className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-xs text-foreground truncate">{fileName}</span>
            </div>
            <button onClick={handleRemove} className="text-muted-foreground hover:text-destructive shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {aiData && (
            <div className="bg-background border border-border rounded-md p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] uppercase tracking-widest text-primary font-mono font-bold">IA extraiu:</span>
                {aiData.confianca != null && (
                  <span className="text-[10px] text-muted-foreground ml-auto">Confiança: {aiData.confianca}%</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {aiData.valor_venda != null && aiData.valor_venda > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor venda</span><span className="font-semibold text-foreground">{formatCurrency(aiData.valor_venda)}</span></div>
                )}
                {aiData.entrada_dinheiro != null && aiData.entrada_dinheiro > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Entrada</span><span className="font-semibold text-foreground">{formatCurrency(aiData.entrada_dinheiro)}</span></div>
                )}
                {aiData.quantidade_parcelas != null && aiData.quantidade_parcelas > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Parcelas</span><span className="font-semibold text-foreground">{aiData.quantidade_parcelas}x</span></div>
                )}
                {aiData.valor_parcela != null && aiData.valor_parcela > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor/parc</span><span className="font-semibold text-foreground">{formatCurrency(aiData.valor_parcela)}</span></div>
                )}
                {aiData.veiculo_troca_descricao && (
                  <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Troca</span><span className="font-semibold text-foreground text-right">{aiData.veiculo_troca_descricao}</span></div>
                )}
                {aiData.cliente_nome && (
                  <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Cliente</span><span className="font-semibold text-foreground text-right">{aiData.cliente_nome}</span></div>
                )}
                {aiData.veiculo_descricao && (
                  <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Veículo</span><span className="font-semibold text-foreground text-right">{aiData.veiculo_descricao}</span></div>
                )}
              </div>
              {aiData.duvidas && (
                <div className="bg-orange-500/5 border border-orange-500/20 rounded p-2 text-[11px] text-orange-300 mt-1">{aiData.duvidas}</div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">Revise e ajuste os campos abaixo antes de salvar.</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
