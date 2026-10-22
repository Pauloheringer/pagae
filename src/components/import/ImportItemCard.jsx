import React from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';

const inputCls = 'w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary';
const TYPES = { comprovante_pagamento: 'Comprovante de pagamento', resumo_parcelado: 'Resumo parcelado', resumo_sem_parcelamento: 'Resumo sem parcelamento', outro: 'Outro documento' };

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</span>
      {children}
    </label>
  );
}

export default function ImportItemCard({ item, warnings, suggestions, onData, onChange }) {
  const d = item.data;
  const num = (k) => (
    <input type="number" step="0.01" className={inputCls} value={d[k] ?? ''} onChange={e => onData({ [k]: e.target.value === '' ? null : Number(e.target.value) })} />
  );
  return (
    <div className="bg-card border border-border rounded-md p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileText className="w-4 h-4 text-primary" /> <span className="truncate">{item.fileName}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{TYPES[d.tipo_documento] || 'Outro documento'}</span>
      </div>
      {item.status === 'duplicate' && <div className="text-xs text-orange-300 bg-orange-500/5 border border-orange-500/20 rounded p-2">Documento {d.numero_documento} já foi importado. Não será gravado novamente.</div>}
      {d.tipo_documento === 'comprovante_pagamento' && <div className="text-xs text-yellow-400">Este PDF parece prova de pagamento: use a Conferência para dar baixa. Aqui ele só será anexado.</div>}
      {item.status !== 'duplicate' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Contrato (origem)"><input className={inputCls} value={d.numero_contrato || ''} onChange={e => onData({ numero_contrato: e.target.value })} /></Field>
            <Field label="Data de referência"><input type="date" className={inputCls} value={d.data_geracao || ''} onChange={e => onData({ data_geracao: e.target.value })} /></Field>
            <Field label="Cliente (PDF)"><input className={inputCls} value={d.cliente_nome || ''} onChange={e => onData({ cliente_nome: e.target.value })} /></Field>
            <Field label="CPF (PDF)"><input className={inputCls} value={d.cliente_cpf || ''} placeholder="não informado" onChange={e => onData({ cliente_cpf: e.target.value })} /></Field>
            <Field label="Telefone"><input className={inputCls} value={d.cliente_telefone || ''} onChange={e => onData({ cliente_telefone: e.target.value })} /></Field>
            <Field label="Data do contrato"><input type="date" className={inputCls} value={d.data_contrato || ''} onChange={e => onData({ data_contrato: e.target.value })} /></Field>
            <Field label="Valor emprestado">{num('valor_emprestado')}</Field>
            <Field label="Valor total">{num('valor_total')}</Field>
            <Field label="Juros previstos">{num('juros_previstos')}</Field>
            <Field label="Recebimentos acumulados">{num('recebimentos_acumulados')}</Field>
            <Field label="Saldo em aberto (posição inicial)">{num('saldo_aberto')}</Field>
            <Field label="Forma no Pagaê"><div className="text-sm py-1.5">{d.forma_pagamento || '—'} · {d.quantidade_parcelas || 0} parcela(s)</div></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Classificar no novo sistema">
              <select className={inputCls} value={item.classificacao} onChange={e => onChange({ classificacao: e.target.value })}>
                <option value="">Selecione...</option>
                <option value="parcelado">Dívida parcelada</option>
                <option value="sem_parcelamento">Dívida sem parcelamento</option>
                <option value="venda">Venda de veículo</option>
              </select>
            </Field>
            <Field label="Vincular ao cliente">
              <select className={inputCls} value={item.customerChoice} onChange={e => onChange({ customerChoice: e.target.value })}>
                <option value="">Selecione...</option>
                {suggestions.map(c => <option key={c.id} value={c.id}>{c.nome_completo} · CPF {c.cpf}</option>)}
                <option value="novo">Cadastrar novo cliente</option>
              </select>
            </Field>
          </div>
          {(d.parcelas || []).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-primary">{d.parcelas.length} parcela(s) do PDF</summary>
              <div className="max-h-40 overflow-y-auto scrollbar-thin mt-2 space-y-0.5">
                {d.parcelas.map(p => (
                  <div key={p.numero} className="flex justify-between text-muted-foreground">
                    <span>#{p.numero} · {formatDate(p.vencimento)}</span>
                    <span>{p.valor_contratado == null ? 'Não disponível no histórico' : formatCurrency(p.valor_contratado)} · {p.status}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          {warnings.map((w, i) => (
            <div key={i} className="flex gap-2 text-xs text-orange-300 bg-orange-500/5 border border-orange-500/20 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span>{w}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
