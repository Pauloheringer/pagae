import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency, formatDate } from '@/lib/format';
import { BarChart3, Download, Calendar, TrendingUp, Wallet, Check, FileWarning, Banknote } from 'lucide-react';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [pixKeys, setPixKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');

  const loadData = useCallback(async () => {
    try {
      const [r, i, pk] = await Promise.all([
        base44.entities.PaymentReport.list('-created_date', 500),
        base44.entities.Installment.list('-created_date', 500),
        base44.entities.PixKey.list('-created_date', 50),
      ]);
      setReports(r); setInstallments(i); setPixKeys(pk);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getDateRange = () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (period === 'today') return { start: today, end: today };
    if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { start, end: today };
    }
    if (period === 'year') {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      return { start, end: today };
    }
    return { start: '2000-01-01', end: today };
  };

  const { start, end } = getDateRange();
  const inRange = (dateStr) => {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    return d >= start && d <= end;
  };

  const periodReports = reports.filter(r => inRange(r.data_pagamento || r.created_date));
  const periodConfirmed = installments.filter(i => i.data_confirmacao && inRange(i.data_confirmacao));
  const periodNoReceipt = periodReports.filter(r => !r.tem_comprovante);
  const periodPending = periodReports.filter(r => r.status === 'informado' || r.status === 'em_analise');
  const periodDivergence = periodReports.filter(r => r.status === 'divergencia');

  const totalClaimed = periodReports.reduce((s, r) => s + (r.valor_informado || 0), 0);
  const totalConfirmed = periodConfirmed.reduce((s, i) => s + (i.valor_pago || 0), 0);

  // By receiving account
  const byAccount = {};
  periodConfirmed.forEach(i => {
    const report = periodReports.find(r => r.parcela_id === i.id);
    const acc = report?.conta_recebedora || 'Não informada';
    byAccount[acc] = (byAccount[acc] || 0) + (i.valor_pago || 0);
  });

  const exportCSV = () => {
    const rows = [['Data Pagamento', 'Data Confirmação', 'Cliente', 'Valor', 'Status', 'Origem', 'Conta Recebedora', 'Conferido Por']];
    periodReports.forEach(r => {
      rows.push([
        formatDate(r.data_pagamento),
        formatDate(r.data_conferencia),
        r.dados_ia_pagador || '',
        r.valor_informado || '',
        r.status,
        r.origem,
        r.conta_recebedora || '',
        r.conferido_por || ''
      ]);
    });
    const csv = rows.map(row => row.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio-pagae-${period}.csv`; a.click();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full p-8"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Relatórios & Export
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fechamento diário, mensal e anual</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 bg-secondary border border-border hover:bg-accent font-semibold text-sm px-4 py-2.5 rounded-md">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Period filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'today', label: 'Hoje' },
          { key: 'month', label: 'Este Mês' },
          { key: 'year', label: 'Este Ano' },
          { key: 'all', label: 'Todo Histórico' },
        ].map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              period === p.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> {p.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={Wallet} label="Total Informado" value={formatCurrency(totalClaimed)} sub={`${periodReports.length} lançamentos`} />
        <Card icon={Check} label="Confirmado" value={formatCurrency(totalConfirmed)} sub={`${periodConfirmed.length} baixas`} accent="green" />
        <Card icon={FileWarning} label="Sem Comprovante" value={String(periodNoReceipt.length)} sub="pagamentos" accent="orange" />
        <Card icon={TrendingUp} label="Divergências" value={String(periodDivergence.length)} sub="pendências" accent="red" />
      </div>

      {/* By account */}
      <div className="bg-card border border-border rounded-md p-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Banknote className="w-4 h-4 text-primary" /> Totais por Conta Recebedora
        </h2>
        <div className="space-y-2">
          {Object.entries(byAccount).map(([acc, val]) => (
            <div key={acc} className="flex justify-between items-center text-sm py-2 border-b border-border last:border-0">
              <span className="text-muted-foreground">{acc}</span>
              <span className="font-bold text-foreground">{formatCurrency(val)}</span>
            </div>
          ))}
          {Object.keys(byAccount).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado para o período.</p>
          )}
        </div>
      </div>

      {/* Detail table */}
      <div className="bg-card border border-border rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Detalhamento de Pagamentos</h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="bg-secondary">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 font-mono uppercase">Data Pag.</th>
                <th className="px-3 py-2 font-mono uppercase">Data Conf.</th>
                <th className="px-3 py-2 font-mono uppercase">Cliente</th>
                <th className="px-3 py-2 font-mono uppercase text-right">Valor</th>
                <th className="px-3 py-2 font-mono uppercase">Status</th>
                <th className="px-3 py-2 font-mono uppercase">Origem</th>
                <th className="px-3 py-2 font-mono uppercase">Conta</th>
                <th className="px-3 py-2 font-mono uppercase">Conferido por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {periodReports.map(r => (
                <tr key={r.id} className="hover:bg-accent/30">
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(r.data_pagamento)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(r.data_conferencia)}</td>
                  <td className="px-3 py-2 text-foreground font-medium truncate max-w-32">{r.dados_ia_pagador || '—'}</td>
                  <td className="px-3 py-2 text-right font-bold text-foreground">{formatCurrency(r.valor_informado)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.origem}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-32">{r.conta_recebedora || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.conferido_por || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, sub, accent }) {
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
