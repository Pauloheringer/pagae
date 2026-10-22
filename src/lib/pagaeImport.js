import { base44 } from '@/api/base44Client';
import { formatCurrency, formatDate } from '@/lib/format';

export const digits = (s) => (s || '').replace(/\D/g, '');
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function matchByCpf(cpf, customers) {
  const d = digits(cpf);
  return d.length === 11 ? customers.find(c => digits(c.cpf) === d) || null : null;
}

// Possíveis cadastros (só sugestão; nunca vincula sozinho por nome)
export function suggestCustomers(data, customers) {
  const tokens = norm(data.cliente_nome).split(/\s+/).filter(t => t.length > 2);
  const phone = digits(data.cliente_telefone).slice(-9);
  return customers.filter(c => {
    const n = norm(c.nome_completo);
    const hits = tokens.filter(t => n.includes(t)).length;
    const ph = digits(c.whatsapp || c.telefone).slice(-9);
    return hits >= 2 || (phone && ph && phone === ph);
  }).slice(0, 5);
}

export function buildWarnings(data, others) {
  const w = [];
  const total = Number(data.valor_total) || 0;
  const rec = Number(data.recebimentos_acumulados) || 0;
  const saldo = Number(data.saldo_aberto) || 0;
  const esperado = +(total - rec).toFixed(2);
  if (Math.abs(saldo - esperado) > 0.01) {
    w.push(`Saldo informado (${formatCurrency(saldo)}) não é explicado por contrato − recebimentos (${formatCurrency(esperado)}). Faltam lançamentos ou regras. Será mantido como posição inicial identificada, sem recálculo.`);
  }
  if (digits(data.cliente_cpf).length !== 11) w.push('PDF sem CPF: não será vinculado por nome. Escolha o cadastro manualmente.');
  if ((data.parcelas || []).some(p => p.valor_contratado == null)) w.push('Há parcelas com "Não disponível no histórico": o valor original fica ausente, sem inventar.');
  if (!data.numero_documento) w.push('Documento sem número identificador: não é possível checar duplicidade automaticamente.');
  const prev = others
    .filter(o => o.numero_contrato === data.numero_contrato && o.data_geracao && o.data_geracao < data.data_geracao)
    .sort((a, b) => b.data_geracao.localeCompare(a.data_geracao))[0];
  if (prev) {
    const v0 = prev.parcelas?.[0]?.vencimento, v1 = data.parcelas?.[0]?.vencimento;
    if (v0 && v1 && v0 !== v1) w.push(`Vencimento mudou: ${formatDate(v0)} → ${formatDate(v1)} (versão de ${formatDate(prev.data_geracao)}).`);
    if (Number(prev.recebimentos_acumulados) !== rec) w.push(`Recebimentos acumulados mudaram: ${formatCurrency(prev.recebimentos_acumulados || 0)} → ${formatCurrency(rec)}. Os valores não são somados e nenhum pagamento é criado automaticamente.`);
  }
  return w;
}

async function resolveCustomer(item) {
  if (item.customerChoice !== 'novo') return item.customerChoice;
  const c = await base44.entities.Customer.create({
    nome_completo: item.data.cliente_nome,
    cpf: digits(item.data.cliente_cpf),
    telefone: digits(item.data.cliente_telefone),
    whatsapp: digits(item.data.cliente_telefone),
    ativo: true,
  });
  return c.id;
}

// Agrupa por contrato: cria (ou reaproveita) o contrato, usa a versão mais recente como posição inicial e anexa todas as versões.
export async function confirmImport(items, userName) {
  const groups = {};
  items.forEach(i => { (groups[i.data.numero_contrato || i.id] ||= []).push(i); });
  let created = 0;
  for (const list of Object.values(groups)) {
    list.sort((a, b) => (a.data.data_geracao || '').localeCompare(b.data.data_geracao || ''));
    const latest = list[list.length - 1];
    const d = latest.data;
    const clienteId = await resolveCustomer(latest);
    const existing = d.numero_contrato ? await base44.entities.Sale.filter({ origem_numero: d.numero_contrato }) : [];
    let sale = existing[0];
    const snapshot = {
      tipo_contrato: latest.classificacao,
      valor_venda: Number(d.valor_total) || 0,
      valor_emprestado: Number(d.valor_emprestado) || 0,
      juros_previstos: Number(d.juros_previstos) || 0,
      regra_juros: [d.cobranca_juros, d.taxa_juros_texto].filter(Boolean).join(' / '),
      saldo_inicial: Number(d.saldo_aberto) || 0,
      saldo_inicial_data: d.data_geracao,
      recebimentos_historicos: Number(d.recebimentos_acumulados) || 0,
      sinalizacoes: latest.warnings.join(' | '),
    };
    if (latest.classificacao === 'sem_parcelamento') snapshot.proximo_vencimento = d.parcelas?.[0]?.vencimento || '';
    if (!sale) {
      sale = await base44.entities.Sale.create({
        numero_contrato: d.numero_contrato || `IMP-${Date.now()}`,
        origem_numero: d.numero_contrato || '',
        cliente_id: clienteId,
        data_contrato: d.data_contrato,
        descricao: d.observacoes || '',
        status: 'ativo',
        quantidade_parcelas: latest.classificacao === 'parcelado' ? d.quantidade_parcelas : undefined,
        ...snapshot,
      });
      if (latest.classificacao === 'parcelado' && d.parcelas?.length) {
        await base44.entities.Installment.bulkCreate(d.parcelas.map(p => ({
          venda_id: sale.id, cliente_id: clienteId, numero: p.numero, vencimento: p.vencimento,
          ...(p.valor_contratado != null ? { valor: p.valor_contratado } : { valor_indisponivel: true }),
          status: /paga/i.test(p.status) ? 'paga' : 'aberta',
          valor_pago: /paga/i.test(p.status) ? Number(p.recebimentos) || 0 : 0,
          conferido_por: 'Importação Pagaê',
        })));
      }
      created++;
    } else if ((sale.saldo_inicial_data || '') < (d.data_geracao || '')) {
      await base44.entities.Sale.update(sale.id, snapshot);
    }
    await base44.entities.ContractDocument.bulkCreate(list.map(i => ({
      venda_id: sale.id, cliente_id: clienteId, arquivo_uri: i.fileUri, nome_arquivo: i.fileName,
      numero_documento: i.data.numero_documento, numero_contrato: i.data.numero_contrato,
      data_geracao: i.data.data_geracao, tipo: i.data.tipo_documento, dados_extraidos: JSON.stringify(i.data), status: 'importado',
    })));
    await base44.entities.AuditLog.create({
      acao: 'importar_pdf', entidade: 'Sale', entidade_id: sale.id,
      detalhes: `Importação de ${list.length} PDF(s) do contrato ${d.numero_contrato}; posição inicial ${snapshot.saldo_inicial} em ${d.data_geracao}`,
      usuario_nome: userName || 'Admin',
    });
  }
  return created;
}
