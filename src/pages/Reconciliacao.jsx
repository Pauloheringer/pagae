import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatDateTime, reportStatusMap } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import ReceiptImage from '@/components/ReceiptImage';
import { Check, X, AlertTriangle, ClipboardCheck } from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';
import ReceiptModal from '@/components/ReceiptModal';
import { confirmPayment } from '@/lib/confirmPayment';

export default function Reconciliacao() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, informado, em_analise, divergencia
  const [actionLoading, setActionLoading] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const r = await base44.entities.PaymentReport.list('-created_date', 200);
      setReports(r);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = reports.filter(r => {
    if (filter === 'all') return r.status !== 'confirmado' && r.status !== 'recusado';
    return r.status === filter;
  });

  const handleConfirm = async (report) => {
    setActionLoading(report.id);
    try {
      const installment = await confirmPayment({ report, conferidoPor: user?.full_name || 'Financeiro' });
      setReceipt({ report, installment });
      loadData();
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (report) => {
    const just = prompt('Justificativa da divergência/recusa:');
    if (!just) return;
    setActionLoading(report.id);
    try {
      await base44.entities.PaymentReport.update(report.id, {
        status: 'divergencia',
        conferido_por: user?.full_name || 'Financeiro',
        data_conferencia: new Date().toISOString(),
        justificativa: just
      });
      if (report.parcela_id) {
        await base44.entities.Installment.update(report.parcela_id, { status: 'aberta' });
      }
      await base44.entities.AuditLog.create({
        acao: 'recusar_pagamento',
        entidade: 'PaymentReport',
        entidade_id: report.id,
        detalhes: `Recusado: ${just}`,
        usuario_nome: user?.full_name || 'Financeiro'
      });
      loadData();
    } catch (e) { alert('Erro: ' + e.message); }
    finally { setActionLoading(null); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full p-8"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  const filters = [
    { key: 'all', label: 'Todos Pendentes' },
    { key: 'informado', label: 'Informados' },
    { key: 'em_analise', label: 'Em Análise IA' },
    { key: 'divergencia', label: 'Divergências' },
  ];

  return (
    <PullToRefresh onRefresh={loadData}>
    <div className="p-4 lg:p-6 max-w-[1200px] mx-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm -mx-4 -mt-4 px-4 py-3 lg:-mx-6 lg:-mt-6 lg:px-6 border-b border-border space-y-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" /> Conferência do Dia
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tela da responsável financeira — confirme ou recuse pagamentos informados</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 mt-4">
        {filtered.map(r => (
          <div key={r.id} className="bg-card border border-border rounded-md p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Receipt */}
              <div className="lg:w-48 shrink-0">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1.5">Comprovante</div>
                <div className="bg-background border border-border rounded-md flex items-center justify-center overflow-hidden" style={{ minHeight: '120px' }}>
                  {r.tem_comprovante ? (
                    <ReceiptImage fileUri={r.comprovante_url} className="max-h-32 object-contain" alt="Comprovante" />
                  ) : (
                    <div className="text-center p-2">
                      <AlertTriangle className="w-6 h-6 text-orange-400 mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">Sem comprovante</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Info label="Cliente / Pagador" value={r.dados_ia_pagador || '—'} />
                <Info label="Valor Informado" value={formatCurrency(r.valor_informado)} bold />
                <Info label="Data Pagamento" value={formatDateTime(r.data_pagamento)} />
                <Info label="Origem" value={r.origem} />
                <Info label="Conta Recebedora" value={r.conta_recebedora || '—'} />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">Situação</div>
                  <StatusBadge status={r.status} statusMap={reportStatusMap} />
                </div>
                {r.dados_ia_banco && <Info label="Banco (IA)" value={r.dados_ia_banco} />}
                {r.dados_ia_transacao_id && <Info label="ID Transação (IA)" value={r.dados_ia_transacao_id} />}
                {r.ia_duvidas && (
                  <div className="col-span-2 lg:col-span-3 bg-orange-500/5 border border-orange-500/20 rounded p-2 text-xs text-orange-300">
                    <span className="font-semibold">Dúvidas IA:</span> {r.ia_duvidas}
                  </div>
                )}
                {r.justificativa && (
                  <div className="col-span-2 lg:col-span-3 bg-red-500/5 border border-red-500/20 rounded p-2 text-xs text-red-300">
                    <span className="font-semibold">Justificativa:</span> {r.justificativa}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="lg:w-40 shrink-0 flex lg:flex-col gap-2">
                <button
                  onClick={() => handleConfirm(r)}
                  disabled={actionLoading === r.id}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs py-2.5 rounded-md disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" /> Confirmar Baixa
                </button>
                <button
                  onClick={() => handleReject(r)}
                  disabled={actionLoading === r.id}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold text-xs py-2.5 rounded-md border border-destructive/30 disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" /> Recusar
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Check className="w-10 h-10 mx-auto mb-3 text-green-500" />
            <p className="text-sm">Nenhum pagamento pendente. Tudo conferido!</p>
          </div>
        )}
      </div>

      {receipt && (
        <ReceiptModal
          report={receipt.report}
          installment={receipt.installment}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
    </PullToRefresh>
  );
}

function Info({ label, value, bold }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1">{label}</div>
      <div className={`text-xs text-foreground ${bold ? 'font-bold' : 'font-medium'}`}>{value}</div>
    </div>
  );
}
