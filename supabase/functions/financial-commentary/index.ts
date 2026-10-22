import { serve, json, requireAdmin, serviceClient } from '../_shared/http.ts';
import { invokeLLM } from '../_shared/ai.ts';

type Row = Record<string, any>;

function money(v: unknown) {
  const n = Number(v) || 0;
  const [int, dec] = n.toFixed(2).split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

function periodRange(period: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (period === 'today') return { start: today, end: today };
  if (period === 'year') return { start: `${now.getFullYear()}-01-01`, end: today };
  if (period === 'all') return { start: '2000-01-01', end: today };
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  return { start, end: today };
}

serve(async (req) => {
  await requireAdmin(req);

  let period = 'month';
  try {
    const body = await req.json();
    if (body && body.period) period = String(body.period).slice(0, 20);
  } catch {
    period = 'month';
  }

  const db = serviceClient();
  const [{ data: installments = [] }, { data: reports = [] }, { data: customers = [] }] = await Promise.all([
    db.from('installments').select('*').order('created_date', { ascending: false }).limit(500),
    db.from('payment_reports').select('*').order('created_date', { ascending: false }).limit(300),
    db.from('customers').select('id, nome_completo').order('created_date', { ascending: false }).limit(200),
  ]) as [{ data: Row[] }, { data: Row[] }, { data: Row[] }];

  const { start, end } = periodRange(period);
  const today = new Date().toISOString().slice(0, 10);
  const inRange = (d: unknown) => !!d && String(d).slice(0, 10) >= start && String(d).slice(0, 10) <= end;

  const confirmed = installments.filter((i) => inRange(i.data_confirmacao));
  const totalReceived = confirmed.reduce((s, i) => s + (i.valor_pago || i.valor || 0), 0);

  const open = installments.filter((i) => i.status !== 'paga');
  const overdue = open.filter((i) => i.vencimento && String(i.vencimento).slice(0, 10) < today);
  const overdueTotal = overdue.reduce((s, i) => s + ((i.valor || 0) - (i.valor_pago || 0)), 0);
  const portfolio = open.reduce((s, i) => s + ((i.valor || 0) - (i.valor_pago || 0)), 0);

  const periodReports = reports.filter((r) => inRange(r.data_pagamento || r.created_date));
  const pending = reports.filter((r) => r.status === 'informado' || r.status === 'em_analise');
  const pendingTotal = pending.reduce((s, r) => s + (r.valor_informado || 0), 0);
  const divergences = periodReports.filter((r) => r.status === 'divergencia');
  const noReceipt = periodReports.filter((r) => !r.tem_comprovante);

  const getCustomer = (id: string) => customers.find((c) => c.id === id);
  const topDebtors = [...new Set(overdue.map((i) => i.cliente_id))]
    .map((cid) => {
      const list = overdue.filter((i) => i.cliente_id === cid);
      return {
        nome: getCustomer(cid)?.nome_completo || 'Cliente',
        total: list.reduce((s, i) => s + ((i.valor || 0) - (i.valor_pago || 0)), 0),
        parcelas: list.length,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const periodLabel = period === 'today' ? 'hoje' : period === 'year' ? 'neste ano' : period === 'all' ? 'em todo o histórico' : 'neste mês';

  const prompt = `Você é o analista financeiro do Pagaê, sistema de gestão de recebimentos da loja de veículos Paulinho Veículos.
Escreva um COMENTÁRIO FINANCEIRO em português do Brasil, claro e profissional, para o dono da loja.

DADOS REAIS (${periodLabel}):
- Recebido (baixas confirmadas): ${money(totalReceived)} em ${confirmed.length} parcela(s)
- Saldo em carteira (parcelas em aberto): ${money(portfolio)} em ${open.length} parcela(s)
- Inadimplência: ${money(overdueTotal)} em ${overdue.length} parcela(s) atrasada(s)
- Pagamentos aguardando conferência: ${money(pendingTotal)} em ${pending.length} lançamento(s)
- Divergências no período: ${divergences.length}
- Pagamentos informados sem comprovante: ${noReceipt.length}
- Clientes com mais parcelas atrasadas: ${topDebtors.map((d) => `${d.nome} (${money(d.total)} em ${d.parcelas} parcela(s))`).join('; ') || 'nenhum'}

Regras:
- Baseie-se APENAS nos dados acima. Nunca invente números.
- Estrutura: um parágrafo de panorama geral, um sobre pontos de atenção e um com recomendações práticas.
- Seja objetivo, cite os valores exatos e evite jargão excessivo.
- 3 a 5 parágrafos curtos. Não use markdown nem emojis.`;

  const comentario = await invokeLLM({ prompt });
  return json({ comentario, period });
});
