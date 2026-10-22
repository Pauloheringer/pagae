import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency, formatDate, installmentStatusMap } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import { X, Save, Loader2, CalendarClock, Calendar } from 'lucide-react';

export default function ContractEditModal({ sale, customer, vehicle, installments, onClose, onSaved }) {
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [shiftDays, setShiftDays] = useState(30);
  const [shiftFrom, setShiftFrom] = useState('');

  useEffect(() => {
    const initial = {};
    installments.forEach(i => { initial[i.id] = i.vencimento; });
    setEdits(initial);
  }, [installments]);

  const handleDateChange = (id, newDate) => {
    setEdits(e => ({ ...e, [id]: newDate }));
  };

  const handleDefer = (id, days = 30) => {
    const currentDate = edits[id] || installments.find(i => i.id === id)?.vencimento;
    if (!currentDate) return;
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    setEdits(e => ({ ...e, [id]: d.toISOString().slice(0, 10) }));
  };

  const handleShiftAll = () => {
    if (!shiftFrom) return;
    const newEdits = { ...edits };
    installments.forEach(i => {
      if (i.numero >= shiftFrom && i.status !== 'paga') {
        const currentDate = edits[i.id] || i.vencimento;
        const d = new Date(currentDate);
        d.setDate(d.getDate() + shiftDays);
        newEdits[i.id] = d.toISOString().slice(0, 10);
      }
    });
    setEdits(newEdits);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [];
      installments.forEach(i => {
        if (edits[i.id] && edits[i.id] !== i.vencimento) {
          updates.push(base44.entities.Installment.update(i.id, { vencimento: edits[i.id] }));
        }
      });
      await Promise.all(updates);
      onSaved();
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = installments.some(i => edits[i.id] && edits[i.id] !== i.vencimento);
  const openInstallments = installments.filter(i => i.status !== 'paga');

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-bold text-foreground">Editar Parcelas</h2>
            <p className="text-xs text-muted-foreground">
              {sale.numero_contrato} • {customer?.nome_completo} • {vehicle ? `${vehicle.marca} ${vehicle.modelo}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Contract summary */}
          <div className="bg-secondary rounded-md p-3 text-sm grid grid-cols-3 gap-2">
            <div><div className="text-[10px] uppercase text-muted-foreground font-mono">Valor</div><div className="font-bold">{formatCurrency(sale.valor_venda)}</div></div>
            <div><div className="text-[10px] uppercase text-muted-foreground font-mono">Parcelas</div><div className="font-semibold">{sale.quantidade_parcelas}x de {formatCurrency(sale.valor_parcela)}</div></div>
            <div><div className="text-[10px] uppercase text-muted-foreground font-mono">Em aberto</div><div className="font-semibold">{openInstallments.length}</div></div>
          </div>

          {/* Shift all action */}
          {openInstallments.length > 1 && (
            <div className="bg-primary/5 border border-primary/20 rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Adiar parcelas seguintes</span>
              </div>
              <p className="text-xs text-muted-foreground">Adia todas as parcelas em aberto a partir da selecionada.</p>
              <div className="flex gap-2 items-center flex-wrap">
                <select value={shiftFrom} onChange={e => setShiftFrom(parseInt(e.target.value))} className="bg-background border border-border rounded-md px-2 py-1.5 text-sm">
                  <option value="">A partir da...</option>
                  {openInstallments.map(i => <option key={i.id} value={i.numero}>Parcela {i.numero}</option>)}
                </select>
                <input type="number" value={shiftDays} onChange={e => setShiftDays(parseInt(e.target.value) || 0)} className="w-20 bg-background border border-border rounded-md px-2 py-1.5 text-sm" />
                <span className="text-xs text-muted-foreground">dias</span>
                <button onClick={handleShiftAll} disabled={!shiftFrom} className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50">
                  Aplicar
                </button>
              </div>
            </div>
          )}

          {/* Installments list */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Vencimentos</h3>
            {installments.sort((a, b) => a.numero - b.numero).map(inst => {
              const isPaid = inst.status === 'paga';
              const hasChange = edits[inst.id] && edits[inst.id] !== inst.vencimento;
              return (
                <div key={inst.id} className={`bg-background border rounded-md p-3 ${hasChange ? 'border-primary/50' : 'border-border'}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-muted-foreground">#{inst.numero}</span>
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(inst.valor)}</span>
                      <StatusBadge status={inst.status} statusMap={installmentStatusMap} />
                    </div>
                    {hasChange && <span className="text-[10px] text-primary font-semibold">Alterado</span>}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-1 block">Vencimento</label>
                      <input
                        type="date"
                        value={edits[inst.id] || inst.vencimento}
                        onChange={e => handleDateChange(inst.id, e.target.value)}
                        disabled={isPaid}
                        className="w-full bg-card border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </div>
                    {!isPaid && (
                      <button onClick={() => handleDefer(inst.id, 30)} className="text-xs bg-secondary border border-border rounded px-2.5 py-1.5 hover:bg-accent whitespace-nowrap">
                        +30 dias
                      </button>
                    )}
                  </div>
                  {hasChange && (
                    <div className="text-[11px] text-muted-foreground mt-1.5">
                      De {formatDate(inst.vencimento)} → <span className="text-primary font-semibold">{formatDate(edits[inst.id])}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="flex-1 bg-secondary border border-border rounded-md py-2.5 text-sm font-semibold hover:bg-accent">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !hasChanges} className="flex-1 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
