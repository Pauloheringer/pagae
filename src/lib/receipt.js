import { jsPDF } from 'jspdf';
import { base44 } from '@/api/base44Client';
import { formatCPF, formatPhone } from '@/lib/format';

function money(v) {
  const n = Number(v) || 0;
  const [int, dec] = n.toFixed(2).split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

function dateBR(d) {
  if (!d) return '-';
  const s = String(d).slice(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return String(d);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function dateTimeBR(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

function receiptNumber(report) {
  if (report?.id) return String(report.id).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  return String(Date.now()).slice(-8);
}

/** Busca os dados relacionados (cliente, contrato e veículo) para montar o recibo. */
export async function fetchReceiptData(report, installment) {
  const [customer, sale] = await Promise.all([
    report?.cliente_id ? base44.entities.Customer.get(report.cliente_id).catch(() => null) : null,
    report?.venda_id ? base44.entities.Sale.get(report.venda_id).catch(() => null) : null,
  ]);
  let vehicle = null;
  if (sale?.veiculo_id) vehicle = await base44.entities.Vehicle.get(sale.veiculo_id).catch(() => null);
  return { customer, sale, vehicle, installment: installment || null, report };
}

export function generateReceiptPDF({ customer, sale, vehicle, installment, report }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  let y = 40;

  const section = (title) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(M, y, W - 2 * M, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(title, M + 3, y + 5.1);
    doc.setTextColor(30, 41, 59);
    y += 12;
  };
  const row = (label, value) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(String(label), M + 3, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(value), M + 58, y);
    y += 6.5;
  };

  // Cabeçalho
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('PAULINHO VEÍCULOS', M, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Sistema Pagaê - Gestão de Recebimentos', M, 19.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('RECIBO DE PAGAMENTO', W - M, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Nº ${receiptNumber(report)}`, W - M, 19.5, { align: 'right' });

  section('DADOS DO CLIENTE');
  row('Nome', customer?.nome_completo || '-');
  row('CPF', formatCPF(customer?.cpf) || '-');
  row('Telefone', formatPhone(customer?.telefone || customer?.whatsapp) || '-');

  section('CONTRATO');
  row('Contrato nº', sale?.numero_contrato || '-');
  row('Veículo', vehicle ? `${vehicle.marca || ''} ${vehicle.modelo || ''}`.trim() || '-' : sale?.descricao || '-');
  if (vehicle?.placa) row('Placa', String(vehicle.placa).toUpperCase());

  section('PAGAMENTO RECEBIDO');
  row('Parcela', installment?.numero != null ? `Nº ${installment.numero}` : '-');
  row('Data do pagamento', dateBR(report?.data_pagamento || installment?.data_pagamento));
  row('Data da confirmação', dateBR(report?.data_conferencia || installment?.data_confirmacao));
  row('Conta recebedora', report?.conta_recebedora || '-');
  row('Conferido por', report?.conferido_por || installment?.conferido_por || '-');

  const valor = report?.valor_informado ?? installment?.valor_pago ?? installment?.valor ?? 0;

  y += 2;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.roundedRect(M, y, W - 2 * M, 19, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(21, 128, 61);
  doc.text('VALOR RECEBIDO', M + 5, y + 7);
  doc.setFontSize(16);
  doc.text(money(valor), M + 5, y + 15.5);
  doc.setTextColor(30, 41, 59);
  y += 28;

  const nome = customer?.nome_completo || 'o cliente';
  const cpfTxt = formatCPF(customer?.cpf);
  const parcelaTxt = installment?.numero != null ? `referente à parcela nº ${installment.numero}` : 'referente ao pagamento';
  const contratoTxt = sale?.numero_contrato ? ` do contrato nº ${sale.numero_contrato}` : '';
  const declaracao = `Recebemos de ${nome}${cpfTxt ? `, CPF ${cpfTxt}` : ''}, a importância de ${money(valor)}, ${parcelaTxt}${contratoTxt}, dando plena e total quitação da referida parcela.`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const declLines = doc.splitTextToSize(declaracao, W - 2 * M);
  doc.text(declLines, M, y);
  y += declLines.length * 5.4 + 22;

  doc.setDrawColor(148, 163, 184);
  doc.line(M + 15, y, W / 2 - 6, y);
  doc.line(W / 2 + 6, y, W - M - 15, y);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Paulinho Veículos', M + 15, y + 5);
  doc.text('Assinatura do cliente', W / 2 + 6, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento gerado eletronicamente pelo sistema Pagaê em ${dateTimeBR(new Date().toISOString())}.`, M, 288);

  return doc;
}

export function downloadReceipt(data) {
  const doc = generateReceiptPDF(data);
  doc.save(`recibo-${receiptNumber(data?.report)}.pdf`);
}
