// Chat do portal do cliente. Só responde sobre o cliente da sessão assinada
// (no Base44 qualquer pessoa podia perguntar sobre qualquer customer_id).
import { serve, json, serviceClient, HttpError } from '../_shared/http.ts';
import { invokeLLM } from '../_shared/ai.ts';
import { verifySession } from '../_shared/portalSession.ts';

type Row = Record<string, any>;

serve(async (req) => {
  const { session, pergunta } = await req.json();
  const customerId = await verifySession(session);
  if (!pergunta) throw new HttpError(400, 'pergunta é obrigatória');

  const db = serviceClient();
  const { data: customer } = await db.from('customers').select('*').eq('id', customerId).maybeSingle();
  if (!customer) throw new HttpError(404, 'Cliente não encontrado');

  const [{ data: sales = [] }, { data: installments = [] }] = await Promise.all([
    db.from('sales').select('*').eq('cliente_id', customerId),
    db.from('installments').select('*').eq('cliente_id', customerId),
  ]) as [{ data: Row[] }, { data: Row[] }];
  const vehicleIds = sales.map((s) => s.veiculo_id).filter(Boolean);
  const { data: vehicles = [] } = vehicleIds.length
    ? await db.from('vehicles').select('*').in('id', vehicleIds) as { data: Row[] }
    : { data: [] as Row[] };

  const getVehicle = (id: string) => vehicles.find((v) => v.id === id);

  const today = new Date().toISOString().slice(0, 10);
  const openInsts = installments.filter((i) => i.status !== 'paga');
  const paidInsts = installments.filter((i) => i.status === 'paga');
  const overdueInsts = openInsts.filter((i) => i.vencimento < today);
  const totalOutstanding = openInsts.reduce((s, i) => s + ((i.valor || 0) - (i.valor_pago || 0)), 0);
  const totalPaid = paidInsts.reduce((s, i) => s + (i.valor_pago || 0), 0);
  const nextDue = openInsts
    .filter((i) => i.vencimento >= today)
    .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())[0];

  const fmtCurrency = (v: number) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;
  const fmtDate = (d: string) => {
    if (!d) return 'N/A';
    const date = new Date(d.slice(0, 10) + 'T00:00:00');
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
  };

  const salesContext = sales.map((s) => {
    const v = getVehicle(s.veiculo_id);
    const created = s.created_date ? s.created_date.slice(0, 10) : 'N/A';
    const daysSincePurchase = s.created_date ? Math.floor((Date.now() - new Date(s.created_date).getTime()) / (1000 * 60 * 60 * 24)) : null;
    return `- Contrato #${s.numero_contrato} | Veículo: ${v ? v.marca + ' ' + v.modelo + ' (' + (v.ano_fabricacao || '') + ')' : 'N/A'} | Placa: ${v?.placa || 'N/A'} | Valor da venda: ${fmtCurrency(s.valor_venda)} | Entrada: ${fmtCurrency(s.entrada_dinheiro)} | Troca: ${fmtCurrency(s.veiculo_troca_valor)} | Saldo parcelado: ${fmtCurrency(s.saldo_parcelado)} | ${s.quantidade_parcelas}x de ${fmtCurrency(s.valor_parcela)} | Status: ${s.status} | Comprado em: ${fmtDate(created)}${daysSincePurchase != null ? ` (há ${daysSincePurchase} dias)` : ''}`;
  }).join('\n');

  const openContext = openInsts.map((i) => {
    const overdue = i.vencimento < today;
    const daysOverdue = Math.ceil((new Date(today).getTime() - new Date(i.vencimento).getTime()) / (1000 * 60 * 60 * 24));
    return `- Parcela ${i.numero}/${installments.length} | Valor: ${fmtCurrency(i.valor)} | Vencimento: ${fmtDate(i.vencimento)} | Status: ${i.status}${overdue ? ` | ${daysOverdue} dias em atraso` : ''}`;
  }).join('\n');

  const paidContext = paidInsts.map((i) => `- Parcela ${i.numero} | ${fmtCurrency(i.valor)} | Paga em: ${i.data_confirmacao ? i.data_confirmacao.slice(0, 10) : 'N/A'}`).join('\n');

  const prompt = `Você é o assistente virtual do portal do cliente da Paulinho Veículos (sistema Pagaê).
Responda em português brasileiro, de forma amigável, direta e objetiva, como se fosse um atendente da loja.
Use APENAS os dados abaixo. Não invente informações. Se não souber, diga que não tem a informação.

DADOS DO CLIENTE:
- Nome: ${customer.nome_completo}
- CPF: ${customer.cpf || 'N/A'}
- Telefone: ${customer.telefone || 'N/A'}

CONTRATOS (${sales.length}):
${salesContext || 'Nenhum contrato encontrado.'}

PARCELAS EM ABERTO (${openInsts.length}):
${openContext || 'Nenhuma parcela em aberto.'}

PARCELAS PAGAS (${paidInsts.length}):
${paidContext || 'Nenhuma parcela paga ainda.'}

RESUMO FINANCEIRO:
- Total já pago: ${fmtCurrency(totalPaid)}
- Saldo devedor total: ${fmtCurrency(totalOutstanding)}
- Parcelas pagas: ${paidInsts.length} de ${installments.length}
- Parcelas em atraso: ${overdueInsts.length}
${nextDue ? `- Próximo vencimento: Parcela ${nextDue.numero} de ${fmtCurrency(nextDue.valor)} em ${fmtDate(nextDue.vencimento)}` : '- Nenhuma parcela a vencer'}

PERGUNTA DO CLIENTE: ${String(pergunta).slice(0, 1000)}

Responda de forma conversacional e amigável. Se o cliente perguntar sobre saldo devedor, diga o valor exato. Se perguntar quantas parcelas faltam, diga o número. Se perguntar sobre o veículo, dê os detalhes. Se perguntar há quanto tempo comprou, calcule a partir da data de criação do contrato.`;

  const resposta = await invokeLLM({ prompt });
  return json({ resposta });
});
