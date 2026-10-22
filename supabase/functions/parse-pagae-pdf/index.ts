import { serve, json, requireAdmin, HttpError } from '../_shared/http.ts';
import { invokeLLM } from '../_shared/ai.ts';

serve(async (req) => {
  await requireAdmin(req);
  const { file_url } = await req.json();
  if (!file_url) throw new HttpError(400, 'file_url é obrigatório');

  const prompt = `Leia o PDF em anexo e identifique sua natureza PELO CONTEÚDO (nunca pelo nome do arquivo).
tipo_documento:
- "comprovante_pagamento": somente se o conteúdo for a prova de UM pagamento específico (transferência/Pix com pagador, recebedor, valor e data/hora).
- "resumo_parcelado": resumo/status de contrato com várias parcelas.
- "resumo_sem_parcelamento": resumo de dívida em aberto sem parcelamento (ou à vista/único registro).
- "outro": qualquer outro.
Um "Comprovante Financeiro / Status atual do contrato" do Pagaê é um RESUMO, não prova de pagamento.

Extraia exatamente o que está escrito. NÃO invente nem deduza dados. Campo ausente = string vazia ou null.
Datas em YYYY-MM-DD (data_geracao pode ser YYYY-MM-DD). Valores numéricos em reais (ex.: 25000.5). CPF só números.
Nas parcelas, se "Valor contratado" for "Não disponível no histórico", use valor_contratado null.
"observacoes" só recebe o campo "Observações" do contrato (nunca notas de rodapé). "taxa_juros_texto" só se houver "Taxa de juros" no PDF; senão string vazia. Não deduza periodicidade de juros: copie em cobranca_juros e taxa_juros_texto apenas o que o PDF diz.`;

  const dados = await invokeLLM({
    prompt,
    file_urls: [file_url],
    response_json_schema: {
      type: 'object',
      properties: {
        tipo_documento: { type: 'string' },
        numero_documento: { type: 'string' },
        numero_contrato: { type: 'string' },
        data_geracao: { type: 'string' },
        cliente_nome: { type: 'string' },
        cliente_cpf: { type: 'string' },
        cliente_telefone: { type: 'string' },
        data_contrato: { type: 'string' },
        forma_pagamento: { type: 'string' },
        quantidade_parcelas: { type: 'number' },
        metodo_calculo: { type: 'string' },
        cobranca_juros: { type: 'string' },
        taxa_juros_texto: { type: 'string' },
        juros_valor: { type: 'number' },
        cobranca_atraso: { type: 'string' },
        observacoes: { type: 'string' },
        valor_emprestado: { type: 'number' },
        valor_total: { type: 'number' },
        juros_previstos: { type: 'number' },
        recebimentos_acumulados: { type: 'number' },
        saldo_aberto: { type: 'number' },
        parcelas_pagas: { type: 'number' },
        parcelas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              numero: { type: 'number' },
              vencimento: { type: 'string' },
              valor_contratado: { type: ['number', 'null'] },
              saldo_atual: { type: 'number' },
              recebimentos: { type: 'number' },
              status: { type: 'string' },
            },
          },
        },
        confianca: { type: 'number' },
      },
    },
  });

  return json({ dados });
});
