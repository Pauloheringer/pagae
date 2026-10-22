import { serve, json, requireAdmin, HttpError } from '../_shared/http.ts';
import { invokeLLM } from '../_shared/ai.ts';

serve(async (req) => {
  await requireAdmin(req);
  const { file_url } = await req.json();
  if (!file_url) throw new HttpError(400, 'file_url é obrigatório');

  const prompt = `Você é um assistente especializado em ler documentos brasileiros (CPF, CNH, comprovante de residência).
Analise a imagem/PDF em anexo e extraia os dados do documento.

Retorne APENAS um JSON válido com esta estrutura:
{
  "tipo_documento": string (cpf, cnh, comprovante_residencia, ou outro),
  "nome_completo": string (nome completo da pessoa, se visível),
  "cpf": string (apenas números, 11 dígitos, se visível),
  "data_nascimento": string (formato YYYY-MM-DD, se visível),
  "endereco": string (endereço completo: rua, número, bairro, cidade, CEP, se visível),
  "rg": string (número do RG, se visível),
  "nome_mae": string (nome da mãe, se visível),
  "confianca": número de 0 a 100
}

Regras:
- NÃO invente informações. Se um campo não estiver visível ou legível, retorne string vazia.
- O CPF deve conter apenas números (11 dígitos), sem pontos ou traços.
- A data de nascimento deve estar no formato YYYY-MM-DD.
- Para comprovante de residência, extraia o endereço e o nome do titular.`;

  const dados = await invokeLLM({
    prompt,
    file_urls: [file_url],
    response_json_schema: {
      type: 'object',
      properties: {
        tipo_documento: { type: 'string' },
        nome_completo: { type: 'string' },
        cpf: { type: 'string' },
        data_nascimento: { type: 'string' },
        endereco: { type: 'string' },
        rg: { type: 'string' },
        nome_mae: { type: 'string' },
        confianca: { type: 'number' },
      },
    },
  });

  return json({ dados });
});
