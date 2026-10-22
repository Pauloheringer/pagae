import { base44 } from '@/api/base44Client';
import { formatCurrency } from '@/lib/format';

/**
 * Confirma a baixa de um pagamento informado: atualiza o lançamento, marca a parcela
 * como paga, registra auditoria e devolve a parcela atualizada (para emitir o recibo).
 */
export async function confirmPayment({ report, conferidoPor }) {
  const now = new Date().toISOString();
  const quem = conferidoPor || 'Financeiro';

  await base44.entities.PaymentReport.update(report.id, {
    status: 'confirmado',
    conferido_por: quem,
    data_conferencia: now,
  });

  let installment = null;
  if (report.parcela_id) {
    await base44.entities.Installment.update(report.parcela_id, {
      status: 'paga',
      valor_pago: report.valor_informado,
      data_pagamento: report.data_pagamento || now,
      data_confirmacao: now,
      conferido_por: quem,
    });
    installment = await base44.entities.Installment.get(report.parcela_id).catch(() => null);
  }

  await base44.entities.AuditLog.create({
    acao: 'confirmar_pagamento',
    entidade: 'PaymentReport',
    entidade_id: report.id,
    detalhes: `Baixa confirmada: ${formatCurrency(report.valor_informado)}`,
    usuario_nome: quem,
  });

  return installment;
}
