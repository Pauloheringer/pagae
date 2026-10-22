import { serve, json, requireAdmin, HttpError } from '../_shared/http.ts';
import { invokeLLM } from '../_shared/ai.ts';

serve(async (req) => {
  await requireAdmin(req);
  const { file_url } = await req.json();
  if (!file_url) throw new HttpError(400, 'file_url é obrigatório');

  const prompt = `Você é um assistente especializado em ler contratos de venda de veículos e notas promissórias.
Analise a imagem/PDF em anexo e extraia os seguintes dados com a máxima precisão.

Retorne APENAS um JSON válido com esta estrutura exata:
{
  "valor_venda": número (valor total da venda do veículo em reais, sem símbolos),
  "entrada_dinheiro": número (valor da entrada paga em dinheiro, se houver),
  "quantidade_parcelas": número (quantidade total de parcelas),
  "valor_parcela": número (valor de cada parcela em reais),
  "saldo_parcelado": número (saldo que será parcelado = valor venda - entrada - troca, se visível),
  "veiculo_troca_descricao": string (descrição do bem recebido na troca, se houver),
  "veiculo_troca_valor": número (valor do bem recebido na troca, se houver),
  "cliente_nome": string (nome do comprador, se visível),
  "cliente_cpf": string (CPF do comprador, se visível),
  "veiculo_descricao": string (marca, modelo e ano do veículo, se visível),
  "veiculo_placa": string (placa do veículo, se visível),
  "data_primeiro_vencimento": string (data do primeiro vencimento, formato YYYY-MM-DD se possível),
  "numero_contrato": string (número do contrato/promissória, se visível),
  "observacoes": string (qualquer observação relevante visível no documento),
  "duvidas": string (dados ilegíveis ou que não pôde confirmar),
  "confianca": número de 0 a 100 (score de confiança na extração)
}

Regras:
- NÃO invente informações. Se um campo não estiver visível ou legível, retorne null, string vazia ou 0.
- Os valores numéricos devem ser apenas números (ex: 25000.00), sem "R$" ou vírgulas como separador de milhar.
- Se houver múltiplas páginas ou imagens, consolide as informações.
- Priorize extrair: valor total, quantidade de parcelas, valor da parcela e entrada.`;

  const dados = await invokeLLM({
    prompt,
    file_urls: [file_url],
    response_json_schema: {
      type: 'object',
      properties: {
        valor_venda: { type: 'number' },
        entrada_dinheiro: { type: 'number' },
        quantidade_parcelas: { type: 'number' },
        valor_parcela: { type: 'number' },
        saldo_parcelado: { type: 'number' },
        veiculo_troca_descricao: { type: 'string' },
        veiculo_troca_valor: { type: 'number' },
        cliente_nome: { type: 'string' },
        cliente_cpf: { type: 'string' },
        veiculo_descricao: { type: 'string' },
        veiculo_placa: { type: 'string' },
        data_primeiro_vencimento: { type: 'string' },
        numero_contrato: { type: 'string' },
        observacoes: { type: 'string' },
        duvidas: { type: 'string' },
        confianca: { type: 'number' },
      },
    },
  });

  return json({ dados });
});
