import { serve, json, requireAdmin, HttpError } from '../_shared/http.ts';
import { invokeLLM } from '../_shared/ai.ts';

serve(async (req) => {
  await requireAdmin(req);
  const { file_url } = await req.json();
  if (!file_url) throw new HttpError(400, 'file_url é obrigatório');

  const prompt = `Você é um assistente especializado em identificar veículos a partir de fotos.
Analise a foto do veículo em anexo e extraia os seguintes dados.

Retorne APENAS um JSON válido com esta estrutura:
{
  "marca": string (marca do veículo, ex: Honda, Toyota, Chevrolet),
  "modelo": string (modelo do veículo, ex: CG 160, Corolla, Onix),
  "cor": string (cor predominante do veículo),
  "placa": string (placa visível, apenas letras e números, sem símbolos),
  "ano": string (ano visível, se legível),
  "tipo": string (tipo: carro, moto, caminhonete, utilitário, etc.),
  "confianca": número de 0 a 100
}

Regras:
- NÃO invente informações. Se um campo não estiver visível ou legível, retorne string vazia.
- A placa deve conter apenas letras e números (sem traços).`;

  const dados = await invokeLLM({
    prompt,
    file_urls: [file_url],
    response_json_schema: {
      type: 'object',
      properties: {
        marca: { type: 'string' },
        modelo: { type: 'string' },
        cor: { type: 'string' },
        placa: { type: 'string' },
        ano: { type: 'string' },
        tipo: { type: 'string' },
        confianca: { type: 'number' },
      },
    },
  });

  return json({ dados });
});
