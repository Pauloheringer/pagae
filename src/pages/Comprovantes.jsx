import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency, formatDate, reportStatusMap } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import ReceiptImage from '@/components/ReceiptImage';
import { ScanLine, Filter, Upload } from 'lucide-react';
import { analyzeReceipt } from '@/functions/analyzeReceipt';

export default function Comprovantes() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const r = await base44.entities.PaymentReport.list('-created_date', 200);
      setReports(r);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpload = async (f) => {
    setUploading(true);
    setAiResult(null);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: f });
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });
      const result = await analyzeReceipt({ file_url: signed_url });
      setAiResult({ dados: result.data?.dados || result.data, file_uri });
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setUploading(false); }
  };

  const filtered = reports.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'com_comprovante') return r.tem_comprovante;
    if (filter === 'sem_comprovante') return !r.tem_comprovante;
    return r.status === filter;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-full p-8"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <ScanLine className="w-6 h-6 text-primary" /> Caixa de Entrada IA
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Envie comprovantes recebidos para análise automática da IA</p>
      </div>

      {/* Upload zone */}
      <div>
        <label className="block border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files[0] && handleUpload(e.target.files[0])} />
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium">Enviar comprovante para análise da IA</p>
          <p className="text-xs text-muted-foreground mt-1">Simula "Compartilhar → Pagaê" do WhatsApp</p>
        </label>
      </div>

      {uploading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">IA analisando comprovante...</span>
        </div>
      )}

      {aiResult && (
        <div className="bg-card border border-primary/30 rounded-md p-4 space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-primary font-mono">Resultado da Análise IA</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Info label="Pagador" value={aiResult.dados?.pagador} />
            <Info label="Recebedor" value={aiResult.dados?.recebedor} />
            <Info label="Valor" value={aiResult.dados?.valor ? formatCurrency(aiResult.dados.valor) : '—'} />
            <Info label="Banco" value={aiResult.dados?.banco} />
            <Info label="Data/Hora" value={aiResult.dados?.data_hora} />
            <Info label="Status" value={aiResult.dados?.status_pagamento} />
            <Info label="ID Transação" value={aiResult.dados?.transacao_id} />
            <Info label="Confiança" value={aiResult.dados?.confianca ? `${aiResult.dados.confianca}%` : '—'} />
          </div>
          {aiResult.dados?.duvidas && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded p-2 text-xs text-orange-300">{aiResult.dados.duvidas}</div>
          )}
          <p className="text-[11px] text-muted-foreground">A IA extraiu os dados. Um responsável deve sugerir o cliente/contrato/parcela e confirmar a baixa.</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'com_comprovante', label: 'Com Comprovante' },
          { key: 'sem_comprovante', label: 'Sem Comprovante' },
          { key: 'em_analise', label: 'Em Análise' },
          { key: 'divergencia', label: 'Divergências' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Gallery */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(r => (
          <div key={r.id} className="bg-card border border-border rounded-md overflow-hidden">
            <div className="bg-background flex items-center justify-center" style={{ minHeight: '100px' }}>
              {r.tem_comprovante ? (
                <ReceiptImage fileUri={r.comprovante_url} className="max-h-28 object-contain" alt="Comprovante" />
              ) : (
                <div className="text-center p-2">
                  <p className="text-[10px] text-muted-foreground">Sem comprovante</p>
                </div>
              )}
            </div>
            <div className="p-2.5 space-y-1">
              <div className="text-xs font-semibold text-foreground truncate">{r.dados_ia_pagador || 'Cliente'}</div>
              <div className="text-xs font-bold text-foreground">{formatCurrency(r.valor_informado)}</div>
              <div className="text-[10px] text-muted-foreground">{formatDate(r.data_pagamento || r.created_date)}</div>
              <StatusBadge status={r.status} statusMap={reportStatusMap} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground font-mono">{label}</div>
      <div className="text-foreground font-medium">{value || '—'}</div>
    </div>
  );
}
