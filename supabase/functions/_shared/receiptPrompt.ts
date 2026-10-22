export const RECEIPT_PROMPT = `Você é um assistente financeiro especializado em ler comprovantes de transferência Pix e TED/DOC bancário.
Analise a imagem/PDF do comprovante em anexo e extraia os seguintes dados com a máxima precisão.

Retorne APENAS um JSON válido com esta estrutura exata:
{
  "pagador": "nome do pagador (quem enviou o dinheiro)",
  "recebedor": "nome do recebedor (quem recebeu)",
  "valor": número (valor da transação em reais, sem símbolos),
  "data_hora": "data e horário da transação (formato ISO se possível, ou texto como aparece)",
  "banco": "nome do banco da transação",
  "transacao_id": "identificador/código da transação (ID end-to-end, autenticação, etc.)",
  "status_pagamento": "realizado" ou "agendado" (se aparecer que é agendado/programado, marque agendado)",
  "duvidas": "quaisquer dúvidas, dados ilegíveis, ou informações que não pôde confirmar",
  "confianca": número de 0 a 100 (score de confiança na extração)
}

Regras:
- NÃO invente informações. Se um campo não estiver visível ou legível, retorne null ou string vazia.
- Uma imagem sozinha NÃO comprova que o dinheiro entrou na conta. Apenas extraia o que aparece no comprovante.
- Se houver indicação de "agendado" ou "programado", marque status como "agendado".
- O valor deve ser apenas o número (ex: 1000.00), sem "R$" ou vírgulas como separador de milhar.`;

export const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    pagador: { type: 'string' },
    recebedor: { type: 'string' },
    valor: { type: 'number' },
    data_hora: { type: 'string' },
    banco: { type: 'string' },
    transacao_id: { type: 'string' },
    status_pagamento: { type: 'string' },
    duvidas: { type: 'string' },
    confianca: { type: 'number' },
  },
};
