import { serve, json, requireAdmin, HttpError } from '../_shared/http.ts';
import { invokeLLM } from '../_shared/ai.ts';
import { RECEIPT_PROMPT, RECEIPT_SCHEMA } from '../_shared/receiptPrompt.ts';

serve(async (req) => {
  await requireAdmin(req);
  const { file_url } = await req.json();
  if (!file_url) throw new HttpError(400, 'file_url é obrigatório');

  const dados = await invokeLLM({ prompt: RECEIPT_PROMPT, file_urls: [file_url], response_json_schema: RECEIPT_SCHEMA });
  return json({ dados });
});
