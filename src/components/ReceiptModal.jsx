import React, { useState, useEffect } from 'react';
import { fetchReceiptData, downloadReceipt } from '@/lib/receipt';
import { formatCurrency, formatDate } from '@/lib/format';
import { Check, Download, MessageCircle, X } from 'lucide-react';

export default function ReceiptModal({ report, installment, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchReceiptData(report, installment)
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [report, installment]);

  const valor = report?.valor_informado ?? installment?.valor_pago ?? installment?.valor ?? 0;

  const handleDownload = () => {
    if (data) downloadReceipt(data);
  };

  const handleNotify = () => {
    const c = data?.customer;
    const phone = (c?.whatsapp || c?.telefone || '').replace(/\D/g, '');
    if (!phone) { alert('Cliente sem telefone/WhatsApp cadastrado'); return; }
    const primeiroNome = c?.nome_completo?.split(' ')[0] || '';
    const contrato = data?.sale?.numero_contrato ? `#${data.sale.numero_contrato}` : '-';
    const msg = `Olá, ${primeiroNome}! Confirmamos o recebimento do seu pagamento.\n\nContrato: ${contrato}\nParcela: ${installment?.numero ?? '-'}\nValor recebido: ${formatCurrency(valor)}\nData: ${formatDate(report?.data_conferencia)}\n\nO recibo já foi gerado no sistema Pagaê. Qualquer dúvida, estamos à disposição.\n— Paulinho Veículos`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-md w-full max-w-md">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground text-sm">Baixa confirmada</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-green-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Recebimento registrado e recibo gerado</p>
            <p className="text-xs text-muted-foreground mt-1">Agora avise o cliente e entregue o recibo.</p>
          </div>

          <div className="bg-secondary rounded-md p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-semibold text-foreground text-right truncate max-w-[60%]">
                {loading ? '...' : data?.customer?.nome_completo || report?.dados_ia_pagador || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contrato</span>
              <span className="font-semibold text-foreground">{data?.sale?.numero_contrato ? `#${data.sale.numero_contrato}` : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Parcela</span>
              <span className="font-semibold text-foreground">{installment?.numero ?? '-'}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
              <span className="text-muted-foreground">Valor recebido</span>
              <span className="font-bold text-green-400">{formatCurrency(valor)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleDownload}
              disabled={loading || !data}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Baixar recibo (PDF)
            </button>
            <button
              onClick={handleNotify}
              disabled={loading || !data}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm py-3 rounded-md disabled:opacity-50"
            >
              <MessageCircle className="w-4 h-4" /> Avisar cliente no WhatsApp
            </button>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border">
          <button onClick={onClose} className="w-full bg-secondary border border-border rounded-md py-2.5 text-sm font-semibold hover:bg-accent">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
