import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatCurrency, formatDate, formatDateTime, reportStatusMap, installmentStatusMap } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import ReceiptImage from '@/components/ReceiptImage';
import { Image as ImageIcon, Check, X, AlertTriangle, TrendingUp, Wallet, FileWarning, Banknote, Clock, ScanLine, Wifi } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [pixKey, setPixKey] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pendingReports, allReports, insts, activeKeys, custs] = await Promise.all([
        base44.entities.PaymentReport.filter({ status: 'informado' }, '-created_date', 50),
        base44.entities.PaymentReport.list('-created_date', 200),
        base44.entities.Installment.list('-created_date', 500),
        base44.entities.PixKey.filter({ ativo: true }),
        base44.entities.Customer.list('-ultimo_acesso', 200),
      ]);
      setReports(pendingReports);
      setInstallments(insts);
      setCustomers(custs);
      if (activeKeys.length > 0) setPixKey(activeKeys[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toISOString().slice(0, 10);
  const totalClaimed = reports.reduce((s, r) => s + (r.valor_informado || 0), 0);
  const confirmedToday = installments.filter(i => i.data_confirmacao?.slice(0, 10) === today);
  const totalConfirmed = confirmedToday.reduce((s, i) => s + (i.valor_pago || 0), 0);
  const noReceipt = reports.filter(r => !r.tem_comprovante);
  const overdueInsts = installments.filter(i => i.status === 'atrasada' || (i.status === 'aberta' && new Date(i.vencimento) < new Date()));
  const onlineClients = customers.filter(c => c.ultimo_acesso && (Date.now() - new Date(c.ultimo_acesso).getTime()) < 5 * 60 * 1000);

  const handleConfirm = async (report) => {
    setActionLoading(true);
    try {
      await base44.entities.PaymentReport.update(report.id, {
        status: 'confirmado',
        conferido_por: user?.full_name || 'Admin',
        data_conferencia: new Date().toISOString()
      });
      if (report.parcela_id) {
        await base44.entities.Installment.update(report.parcela_id, {
          status: 'paga',
          valor_pago: report.valor_informado,
          data_pagamento: report.data_pagamento || new Date().toISOString(),
          data_confirmacao: new Date().toISOString(),
          conferido_por: user?.full_name || 'Admin'
        });
      }
      await base44.entities.AuditLog.create({
        acao: 'confirmar_pagamento',
        entidade: 'PaymentReport',
        entidade_id: report.id,
        detalhes: `Pagamento de ${formatCurrency(report.valor_informado)} confirmado`,
        usuario_nome: user?.full_name || 'Admin'
      });
      setSelected(null);
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (report, justificativa) => {
    setActionLoading(true);
    try {
      await base44.entities.PaymentReport.update(report.id, {
        status: 'divergencia',
        conferido_por: user?.full_name || 'Admin',
        data_conferencia: new Date().toISOString(),
        justificativa
      });
      await base44.entities.AuditLog.create({
        acao: 'recusar_pagamento',
        entidade: 'PaymentReport',
        entidade_id: report.id,
        detalhes: `Divergência: ${justificativa}`,
        usuario_nome: user?.full_name || 'Admin'
      });
      setSelected(null);
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full p-8"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-[1600px] mx-auto">
      {/* Hero greeting */}
      <div>
        <h1 className="text-2xl lg:text-[clamp(1.75rem,3vw,2.5rem)] font-extrabold tracking-tight text-foreground">
          Conferência do Dia
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} — {reports.length} pagamento(s) aguardando conferência
        </p>
      </div>

      {/* Online clients */}
      {onlineClients.length > 0 && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-4 h-4 text-green-400" />
            <h2 className="text-sm font-bold text-foreground">Clientes Online no Portal</h2>
            <span className="text-[11px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded font-mono">{onlineClients.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {onlineClients.map(c => (
              <div key={c.id} className="flex items-center gap-1.5 bg-card border border-border rounded-md px-2.5 py-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-medium text-foreground">{c.nome_completo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Split panel: Queue + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Queue panel (60%) */}
        <div className="lg:col-span-3 bg-card border border-border rounded-md flex flex-col" style={{ minHeight: '500px' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-primary" />
              Fila de Conferência
            </h2>
            <div className="flex gap-1.5">
              <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">{reports.length} pendentes</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-border">
            {reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Check className="w-10 h-10 text-green-500 mb-3" />
                <p className="text-sm text-muted-foreground">Tudo em dia! Nenhum pagamento aguardando conferência.</p>
              </div>
            ) : (
              reports.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-center gap-3 ${selected?.id === r.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-foreground truncate">{r.dados_ia_pagador || 'Cliente'}</span>
                      {r.tem_comprovante ? (
                        <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded font-mono">IA</span>
                      ) : (
                        <span className="text-[10px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded font-mono">SEM COMP.</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.dados_ia_banco || 'Sem banco identificado'} • {formatDateTime(r.data_pagamento || r.created_date)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-foreground">{formatCurrency(r.valor_informado)}</div>
                    {r.ia_match_score != null && (
                      <div className="text-[10px] text-muted-foreground">Score: {r.ia_match_score}%</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Inspector panel (40%) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-md flex flex-col" style={{ minHeight: '500px' }}>
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Inspetor de Auditoria</h2>
          </div>
          {selected ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
                {/* Receipt preview */}
                <div className="bg-background border border-border rounded-md p-3 flex items-center justify-center" style={{ minHeight: '180px' }}>
                  {selected.tem_comprovante ? (
                    <ReceiptImage fileUri={selected.comprovante_url} className="max-h-48 rounded object-contain" alt="Comprovante" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Cliente informou pagamento sem comprovante.<br/>Conferir recebimento no extrato.</p>
                    </div>
                  )}
                </div>

                {/* AI extracted fields */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Dados Extraídos pela IA</div>
                  <Field label="Pagador" value={selected.dados_ia_pagador} />
                  <Field label="Recebedor" value={selected.dados_ia_recebedor} />
                  <Field label="Valor" value={selected.dados_ia_valor != null ? formatCurrency(selected.dados_ia_valor) : null} />
                  <Field label="Data/Hora" value={selected.dados_ia_data} />
                  <Field label="Banco" value={selected.dados_ia_banco} />
                  <Field label="ID Transação" value={selected.dados_ia_transacao_id} />
                  <Field label="Status" value={selected.dados_ia_status} />
                  {selected.ia_duvidas && (
                    <div className="bg-orange-500/5 border border-orange-500/20 rounded p-2">
                      <div className="text-[10px] uppercase text-orange-400 font-mono mb-1">Dúvidas da IA</div>
                      <p className="text-xs text-orange-300">{selected.ia_duvidas}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Dados do Lançamento</div>
                  <Field label="Valor Informado" value={formatCurrency(selected.valor_informado)} />
                  <Field label="Origem" value={selected.origem} />
                  <Field label="Conta Recebedora" value={selected.conta_recebedora || 'Não definida'} />
                  <StatusBadge status={selected.status} statusMap={reportStatusMap} />
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-border space-y-2">
                <button
                  onClick={() => handleConfirm(selected)}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm py-2.5 rounded-md transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Confirmar Recebimento e Dar Baixa
                </button>
                <button
                  onClick={() => {
                    const just = prompt('Justificativa da divergência:');
                    if (just) handleReject(selected, just);
                  }}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold text-sm py-2.5 rounded-md transition-colors disabled:opacity-50 border border-destructive/30"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Sinalizar Divergência / Pedir Novo
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <ScanLine className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Selecione um pagamento da fila para inspecionar o comprovante e os dados extraídos pela IA.</p>
            </div>
          )}
        </div>
      </div>

      {/* Daily closing bento cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BentoCard icon={Wallet} label="Total Informado" value={formatCurrency(totalClaimed)} sub={`${reports.length} lançamentos`} />
        <BentoCard icon={Check} label="Confirmado Hoje" value={formatCurrency(totalConfirmed)} sub={`${confirmedToday.length} baixas`} accent="green" />
        <BentoCard icon={FileWarning} label="Sem Comprovante" value={formatCurrency(noReceipt.reduce((s, r) => s + (r.valor_informado || 0), 0))} sub={`${noReceipt.length} pagamentos`} accent="orange" />
        <BentoCard icon={Clock} label="Parcelas Atrasadas" value={String(overdueInsts.length)} sub="precisam revisão" accent="red" />
      </div>

      {pixKey && (
        <div className="bg-primary/5 border border-primary/20 rounded-md p-4 flex items-center gap-3">
          <Banknote className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Chave Pix ativa no momento</div>
            <div className="text-sm font-bold text-foreground">{pixKey.tipo.toUpperCase()}: {pixKey.chave} — {pixKey.titular} ({pixKey.banco})</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground font-medium text-right">{value || '—'}</span>
    </div>
  );
}

function BentoCard({ icon: Icon, label, value, sub, accent }) {
  const accentMap = {
    green: 'text-green-400 bg-green-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
    red: 'text-red-400 bg-red-500/10',
    blue: 'text-primary bg-primary/10'
  };
  const accentClass = accentMap[accent] || 'text-primary bg-primary/10';
  return (
    <div className="bg-card border border-border rounded-md p-4">
      <div className={`w-8 h-8 rounded-md flex items-center justify-center mb-3 ${accentClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-lg lg:text-xl font-extrabold text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mt-1">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
