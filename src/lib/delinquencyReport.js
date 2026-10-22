import { jsPDF } from 'jspdf';
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

function stamp() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/**
 * Gera e baixa o relatório de inadimplência em PDF, com todos os dados cadastrais
 * do cliente, contratos, veículos e as parcelas em atraso de cada um.
 */
export function downloadDelinquencyReport({ debtors, totals, generatedBy, generatedAt }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  let y;

  const drawHeader = () => {
    doc.setFillColor(127, 29, 29);
    doc.rect(0, 0, W, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('PAULINHO VEÍCULOS', M, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Relatório de Inadimplência - Sistema Pagaê', M, 19);
    doc.setTextColor(30, 41, 59);
    y = 34;
  };
  drawHeader();

  const ensure = (h) => {
    if (y + h > 280) {
      doc.addPage();
      y = 20;
    }
  };

  // Resumo
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(M, y, W - 2 * M, 22, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Emitido em', M + 4, y + 7);
  doc.text('Emitido por', M + 4, y + 16);
  doc.text('Clientes inadimplentes', W / 2 - 25, y + 7);
  doc.text('Parcelas em atraso', W / 2 - 25, y + 16);
  doc.text('Valor total em atraso', W - M - 4, y + 7, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dateTimeBR(generatedAt), M + 30, y + 7);
  doc.text(String(generatedBy || '-'), M + 30, y + 16);
  doc.text(String(totals?.clientes ?? 0), W / 2 + 15, y + 7);
  doc.text(String(totals?.parcelas ?? 0), W / 2 + 15, y + 16);
  doc.setTextColor(153, 27, 27);
  doc.text(money(totals?.valor ?? 0), W - M - 4, y + 7, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  y += 30;

  if (!debtors || debtors.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Nenhum cliente inadimplente encontrado.', M, y);
    doc.save(`relatorio-inadimplencia-${stamp()}.pdf`);
    return;
  }

  debtors.forEach((d, idx) => {
    ensure(50);

    doc.setFillColor(254, 242, 242);
    doc.rect(M, y, W - 2 * M, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${idx + 1}. ${d.nome}`, M + 3, y + 6.2);
    doc.setTextColor(153, 27, 27);
    doc.text(money(d.total), W - M - 3, y + 6.2, { align: 'right' });
    y += 13;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const info = [
      ['CPF', formatCPF(d.cpf) || '-'],
      ['Telefone', formatPhone(d.telefone) || '-'],
      ['WhatsApp', formatPhone(d.whatsapp) || '-'],
      ['E-mail', d.email || '-'],
      ['Nascimento', dateBR(d.data_nascimento)],
    ];
    info.forEach(([label, value]) => {
      ensure(6);
      doc.setTextColor(148, 163, 184);
      doc.text(label, M + 3, y);
      doc.setTextColor(30, 41, 59);
      doc.text(String(value), M + 32, y);
      y += 5.2;
    });

    const blocks = [
      ['Endereço', d.endereco || '-'],
      ['Contratos', d.contratos || '-'],
      ['Veículos', d.veiculos || '-'],
    ];
    blocks.forEach(([label, value]) => {
      const lines = doc.splitTextToSize(String(value), W - M - 35);
      ensure(lines.length * 5.2 + 1);
      doc.setTextColor(148, 163, 184);
      doc.text(label, M + 3, y);
      doc.setTextColor(30, 41, 59);
      doc.text(lines, M + 32, y);
      y += lines.length * 5.2;
    });
    y += 3;

    // Cabeçalho das parcelas
    ensure(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('PARCELA', M + 3, y);
    doc.text('VENCIMENTO', M + 33, y);
    doc.text('ATRASO', M + 62, y);
    doc.text('SITUAÇÃO', M + 90, y);
    doc.text('VALOR', W - M - 3, y, { align: 'right' });
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.line(M, y, W - M, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    (d.parcelas || []).forEach((p) => {
      ensure(6);
      doc.setTextColor(30, 41, 59);
      doc.text(String(p.numero ?? '-'), M + 3, y);
      doc.text(dateBR(p.vencimento), M + 33, y);
      doc.text(`${p.dias} dia(s)`, M + 62, y);
      doc.setTextColor(153, 27, 27);
      doc.text(p.status === 'paga' ? 'Paga' : 'Em aberto', M + 90, y);
      doc.setTextColor(30, 41, 59);
      doc.text(money(p.valor), W - M - 3, y, { align: 'right' });
      y += 5.2;
    });

    y += 2;
    ensure(6);
    doc.setDrawColor(226, 232, 240);
    doc.line(M, y, W - M, y);
    y += 9;
  });

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento gerado pelo sistema Pagaê - página ${i}/${pages}`, M, 288);
  }

  doc.save(`relatorio-inadimplencia-${stamp()}.pdf`);
}
