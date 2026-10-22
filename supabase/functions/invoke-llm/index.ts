// Usado pelo Assistente de IA do painel (perguntas sobre os dados).
import { serve, json, requireAdmin, HttpError } from '../_shared/http.ts';
import { invokeLLM } from '../_shared/ai.ts';

serve(async (req) => {
  await requireAdmin(req);
  const { prompt, file_urls, response_json_schema } = await req.json();
  if (!prompt) throw new HttpError(400, 'prompt é obrigatório');
  const result = await invokeLLM({ prompt, file_urls, response_json_schema });
  return json({ result });
});
