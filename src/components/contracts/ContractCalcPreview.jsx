import React from 'react';
import { formatCurrency, formatDate } from '@/lib/format';
import { Calculator, AlertTriangle, Calendar } from 'lucide-react';

export default function ContractCalcPreview({ form }) {
  const valorVenda = parseFloat(form.valor_venda) || 0;
  const entrada = parseFloat(form.entrada_dinheiro) || 0;
  const trocaValor = parseFloat(form.veiculo_troca_valor) || 0;
  const qtdParc = parseInt(form.quantidade_parcelas) || 0;
  const valorParc = parseFloat(form.valor_parcela) || 0;

  const saldo = valorVenda - entrada - trocaValor;
  const totalParcelado = qtdParc * valorParc;
  const diferenca = saldo - totalParcelado;
  const temDiferenca = Math.abs(diferenca) > 0.01;

  if (!valorVenda && !entrada && !trocaValor && !qtdParc && !valorParc) return null;

  const baseDate = form.vencimento_primeira ? new Date(form.vencimento_primeira) : new Date();
  const parcelasExemplo = [];
  const maxExibir = Math.min(qtdParc, 4);
  for (let i = 0; i < maxExibir; i++) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + i);
    parcelasExemplo.push({ numero: i + 1, vencimento: d.toISOString().slice(0, 10) });
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-md p-4 space-y-3">
      <div className="flex items-center gap-2 text-primary">
        <Calculator className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-widest">Cálculo do Contrato</span>
      </div>

      {/* Breakdown */}
      <div className="space-y-1.5 text-xs font-mono">
        <Row label="Valor da Venda" value={formatCurrency(valorVenda)} />
        <Row label="(-) Entrada em Dinheiro" value={formatCurrency(entrada)} muted />
        <Row label="(-) Bem de Troca" value={formatCurrency(trocaValor)} muted />
        <div className="border-t border-primary/20 pt-1.5">
          <Row label="Saldo a Parcelar" value={formatCurrency(saldo)} bold />
        </div>
        <Row label={`(×) ${qtdParc} parcelas × ${formatCurrency(valorParc)}`} value={formatCurrency(totalParcelado)} />
        {temDiferenca && qtdParc > 0 && valorParc > 0 && (
          <div className={`flex justify-between items-center pt-1.5 border-t border-primary/20 ${diferenca > 0 ? 'text-orange-400' : 'text-green-400'}`}>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {diferenca > 0 ? 'Sobrando:' : 'A mais cobrado:'}
            </span>
            <span className="font-bold">{formatCurrency(Math.abs(diferenca))}</span>
          </div>
        )}
      </div>

      {/* Installment schedule preview */}
      {qtdParc > 0 && valorParc > 0 && (
        <div className="border-t border-primary/20 pt-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase tracking-widest font-bold">Vencimentos das Parcelas</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {parcelasExemplo.map(p => (
              <div key={p.numero} className="flex items-center justify-between bg-background/50 rounded px-2 py-1 text-[11px]">
                <span className="text-muted-foreground">#{String(p.numero).padStart(2, '0')}</span>
                <span className="font-semibold text-foreground">{formatDate(p.vencimento)}</span>
              </div>
            ))}
            {qtdParc > 4 && (
              <div className="col-span-2 text-center text-[10px] text-muted-foreground pt-0.5">
                + {qtdParc - 4} parcela(s) restante(s)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, muted }) {
  return (
    <div className="flex justify-between items-center">
      <span className={muted ? 'text-muted-foreground' : 'text-foreground/80'}>{label}</span>
      <span className={`${bold ? 'font-bold text-foreground' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}
