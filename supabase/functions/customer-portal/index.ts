// Portal do cliente (login por CPF + telefone). Mesmas ações do Base44, mas
// toda ação depois do login exige a sessão assinada em vez do id do cliente.
import { serve, json, serviceClient, requireAdmin, HttpError } from '../_shared/http.ts';
import { invokeLLM } from '../_shared/ai.ts';
import { createSession, verifySession } from '../_shared/portalSession.ts';
import { RECEIPT_PROMPT, RECEIPT_SCHEMA } from '../_shared/receiptPrompt.ts';

type Row = Record<string, any>;
const digits = (s: unknown) => String(s || '').replace(/\D/g, '');

serve(async (req) => {
  const body = await req.json();
  const { action } = body;
  const db = serviceClient();

  // LOGIN: confere CPF + telefone e devolve uma sessão de 30 dias
  if (action === 'login') {
    const cleanCpf = digits(body.cpf);
    const cleanPhone = digits(body.phone);
    if (!cleanCpf || !cleanPhone) throw new HttpError(400, 'CPF e telefone são obrigatórios');
    const { data: customers = [] } = await db.from('customers').select('*').eq('cpf', cleanCpf).limit(1) as { data: Row[] };
    if (customers.length === 0) throw new HttpError(404, 'CPF não encontrado. Procure a loja para se cadastrar.');
    const cust = customers[0];
    if (cust.ativo === false) throw new HttpError(403, 'Conta inativa');
    const custPhone = digits(cust.whatsapp || cust.telefone);
    // Aceita com ou sem o 9 extra / DDD: compara os últimos 8 dígitos.
    if (custPhone && custPhone.slice(-8) !== cleanPhone.slice(-8)) throw new HttpError(403, 'Telefone não confere com o cadastro.');
    await db.from('customers').update({ ultimo_acesso: new Date().toISOString() }).eq('id', cust.id);
    return json({ session: await createSession(cust.id, 30) });
  }

  // ADMIN_LINK: admin gera link do portal / de completar cadastro para um cliente
  if (action === 'adminLink') {
    await requireAdmin(req);
    if (!body.customer_id) throw new HttpError(400, 'customer_id é obrigatório');
    return json({ session: await createSession(body.customer_id, 7) });
  }

  const customerId = await verifySession(body.session);

  // LOAD: todos os dados do portal do cliente
  if (action === 'load') {
    const { data: customer } = await db.from('customers').select('*').eq('id', customerId).maybeSingle();
    if (!customer) throw new HttpError(404, 'Cliente não encontrado');
    const [{ data: sales = [] }, { data: installments = [] }, { data: pixKeys = [] }, { data: waContacts = [] }, { data: reports = [] }] =
      await Promise.all([
        db.from('sales').select('*').eq('cliente_id', customerId),
        db.from('installments').select('*').eq('cliente_id', customerId).order('vencimento', { ascending: true }),
        db.from('pix_keys').select('id, tipo, chave, titular, banco, ativo').eq('ativo', true),
        db.from('whatsapp_contacts').select('id, nome, telefone').eq('ativo', true),
        db.from('payment_reports').select('*').eq('cliente_id', customerId).order('created_date', { ascending: false }),
      ]) as { data: Row[] }[];
    const vehicleIds = [...new Set([...sales.map((s) => s.veiculo_id), ...sales.map((s) => s.veiculo_troca_id)].filter(Boolean))];
    const { data: vehicles = [] } = vehicleIds.length
      ? await db.from('vehicles').select('*').in('id', vehicleIds) as { data: Row[] }
      : { data: [] as Row[] };
    return json({ customer, sales, installments, vehicles, pixKeys, waContacts, reports });
  }

  // UPDATE_CUSTOMER: formulário de completar cadastro
  if (action === 'updateCustomer') {
    const data = body.data || {};
    const allowed = ['nome_completo', 'cpf', 'telefone', 'whatsapp', 'email', 'data_nascimento', 'endereco', 'foto_cpf_url', 'foto_cnh_url', 'foto_comprovante_residencia_url'];
    const fileFields = ['foto_cpf_url', 'foto_cnh_url', 'foto_comprovante_residencia_url'];
    const { data: current } = await db.from('customers').select(fileFields.join(',')).eq('id', customerId).maybeSingle() as { data: Row | null };
    const updateData: Row = {};
    for (const field of allowed) {
      if (data[field] === undefined) continue;
      let value = data[field] === '' ? null : data[field];
      // Arquivos: só aceita os que já eram do cadastro ou que este cliente enviou pelo portal.
      if (fileFields.includes(field) && value && value !== current?.[field] && !String(value).startsWith(`private-files/portal/${customerId}/`)) {
        value = current?.[field] ?? null;
      }
      updateData[field] = value;
    }
    const { error } = await db.from('customers').update(updateData).eq('id', customerId);
    if (error) throw new HttpError(400, error.message);
    return json({ success: true });
  }

  // REPORT_PAYMENT: cliente informa pagamento (com ou sem comprovante); IA lê o comprovante
  if (action === 'reportPayment') {
    const { installment_id, file_uri, no_receipt } = body;
    if (!installment_id) throw new HttpError(400, 'installment_id é obrigatório');
    const { data: installment } = await db.from('installments').select('*').eq('id', installment_id).maybeSingle();
    if (!installment || installment.cliente_id !== customerId) throw new HttpError(404, 'Parcela não encontrada');
    if (file_uri && !String(file_uri).startsWith(`private-files/portal/${customerId}/`)) throw new HttpError(400, 'Comprovante inválido');

    let aiData: Row | null = null;
    if (file_uri && !no_receipt) {
      try {
        const path = String(file_uri).replace(/^private-files\//, '');
        const { data: signed } = await db.storage.from('private-files').createSignedUrl(path, 600);
        if (signed?.signedUrl) {
          aiData = await invokeLLM({ prompt: RECEIPT_PROMPT, file_urls: [signed.signedUrl], response_json_schema: RECEIPT_SCHEMA });
        }
      } catch (e) {
        console.error('Análise do comprovante falhou:', e);
      }
    }

    let autoConfirm = false;
    if (aiData && aiData.data_hora && aiData.valor != null) {
      const parsed = new Date(aiData.data_hora);
      const payDate = isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
      const valueMatch = Math.abs((aiData.valor || 0) - (installment.valor || 0)) < 0.01;
      const dateMatch = payDate === installment.vencimento;
      autoConfirm = valueMatch && dateMatch && aiData.status_pagamento === 'realizado';
    }

    const reportStatus = autoConfirm ? 'confirmado' : (file_uri ? 'em_analise' : 'informado');
    const { data: pixKeys = [] } = await db.from('pix_keys').select('*').eq('ativo', true).limit(1) as { data: Row[] };
    const pixKey = pixKeys[0];
    const now = new Date().toISOString();

    const { error: reportError } = await db.from('payment_reports').insert({
      parcela_id: installment_id,
      venda_id: installment.venda_id,
      cliente_id: customerId,
      valor_informado: aiData?.valor || installment.valor,
      data_pagamento: now,
      origem: 'aplicativo',
      comprovante_url: file_uri || null,
      tem_comprovante: !!file_uri,
      status: reportStatus,
      dados_ia_pagador: aiData?.pagador || null,
      dados_ia_recebedor: aiData?.recebedor || null,
      dados_ia_valor: aiData?.valor ?? null,
      dados_ia_data: aiData?.data_hora || null,
      dados_ia_banco: aiData?.banco || null,
      dados_ia_transacao_id: aiData?.transacao_id || null,
      dados_ia_status: aiData?.status_pagamento || null,
      ia_match_score: aiData?.confianca ?? null,
      ia_duvidas: aiData?.duvidas || null,
      conta_recebedora: pixKey ? `${pixKey.titular} (${pixKey.banco})` : null,
      conferido_por: autoConfirm ? 'Sistema (auto-confirmação)' : null,
      data_conferencia: autoConfirm ? now : null,
      justificativa: autoConfirm ? 'Pagamento Pix confirmado automaticamente: data e valor conferem com o vencimento.' : null,
      created_by: 'portal',
    });
    if (reportError) throw new HttpError(500, reportError.message);

    if (autoConfirm) {
      await db.from('installments').update({
        status: 'paga',
        valor_pago: aiData!.valor,
        data_pagamento: aiData!.data_hora,
        data_confirmacao: now,
        conferido_por: 'Sistema (auto-confirmação)',
      }).eq('id', installment_id);
    } else {
      await db.from('installments').update({ status: 'em_analise' }).eq('id', installment_id);
    }

    return json({ success: true, auto_confirmed: autoConfirm, ai_data: aiData });
  }

  // DELETE_ACCOUNT: anonimiza os dados pessoais, mantém o histórico financeiro
  if (action === 'deleteAccount') {
    await db.from('customers').update({
      nome_completo: 'Cliente Excluído',
      cpf: null,
      telefone: null,
      whatsapp: null,
      email: null,
      data_nascimento: null,
      endereco: null,
      foto_cpf_url: null,
      foto_cnh_url: null,
      foto_comprovante_residencia_url: null,
      ativo: false,
    }).eq('id', customerId);
    return json({ success: true });
  }

  throw new HttpError(400, 'Ação inválida');
});
