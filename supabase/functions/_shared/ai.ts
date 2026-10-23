// Substitui o `InvokeLLM` do Base44. Usa o Google Gemini (tem plano gratuito)
// por padrão; defina AI_PROVIDER=anthropic para usar o Claude.
//
// Segredos (Supabase > Edge Functions > Secrets):
//   GEMINI_API_KEY      chave do Google AI Studio (https://aistudio.google.com/apikey)
//   GEMINI_MODEL        opcional, lista separada por vírgula (padrão: gemini-flash-latest,gemini-flash-lite-latest)
//   AI_PROVIDER         opcional: gemini (padrão) ou anthropic
//   ANTHROPIC_API_KEY   se usar Claude
//   ANTHROPIC_MODEL     opcional, padrão claude-haiku-5-5

type InvokeParams = {
  prompt: string;
  file_urls?: string[];
  response_json_schema?: Record<string, unknown>;
};

type FilePart = { mimeType: string; data: string };

async function fetchFile(url: string): Promise<FilePart> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível baixar o arquivo (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let mimeType = (res.headers.get('content-type') || '').split(';')[0].trim();
  if (!mimeType || mimeType === 'application/octet-stream') {
    const path = new URL(url).pathname.toLowerCase();
    mimeType = path.endsWith('.pdf') ? 'application/pdf'
      : path.endsWith('.png') ? 'image/png'
      : path.endsWith('.webp') ? 'image/webp'
      : 'image/jpeg';
  }
  let binary = '';
  for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { mimeType, data: btoa(binary) };
}

function withJsonInstruction(prompt: string, schema?: Record<string, unknown>) {
  if (!schema) return prompt;
  return `${prompt}\n\nResponda SOMENTE com um objeto JSON válido (sem markdown) que siga este JSON Schema:\n${JSON.stringify(schema)}`;
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('A IA não devolveu um JSON válido');
  }
}

// Os modelos do Gemini são aposentados com frequência e às vezes ficam
// sobrecarregados (503). Os apelidos "-latest" acompanham a versão atual, e
// se um estiver indisponível tentamos o próximo da lista.
const DEFAULT_GEMINI_MODELS = 'gemini-flash-latest,gemini-flash-lite-latest';

async function callGemini(prompt: string, files: FilePart[], wantJson: boolean): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY não configurada nas Edge Functions do Supabase');
  const models = (Deno.env.get('GEMINI_MODEL') || DEFAULT_GEMINI_MODELS).split(',').map((m) => m.trim()).filter(Boolean);
  const payload = JSON.stringify({
    contents: [{
      role: 'user',
      parts: [
        ...files.map((f) => ({ inline_data: { mime_type: f.mimeType, data: f.data } })),
        { text: prompt },
      ],
    }],
    generationConfig: wantJson ? { responseMimeType: 'application/json', temperature: 0.1 } : { temperature: 0.3 },
  });
  let lastError = '';
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: payload,
    });
    const body = await res.json();
    if (res.ok) return (body.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
    lastError = body?.error?.message || String(res.status);
    // Só tenta outro modelo quando o problema é do modelo (sobrecarga, cota, aposentado).
    if (![404, 429, 500, 503].includes(res.status)) break;
  }
  throw new Error(`Gemini: ${lastError}`);
}

async function callClaude(prompt: string, files: FilePart[]): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada nas Edge Functions do Supabase');
  const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-haiku-5-5';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          ...files.map((f) => f.mimeType === 'application/pdf'
            ? { type: 'document', source: { type: 'base64', media_type: f.mimeType, data: f.data } }
            : { type: 'image', source: { type: 'base64', media_type: f.mimeType, data: f.data } }),
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Claude: ${body?.error?.message || res.status}`);
  return (body.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
}

/** Mesmo contrato do InvokeLLM do Base44: com schema devolve objeto, sem schema devolve texto. */
export async function invokeLLM({ prompt, file_urls = [], response_json_schema }: InvokeParams) {
  const files = await Promise.all(file_urls.map(fetchFile));
  const fullPrompt = withJsonInstruction(prompt, response_json_schema);
  const provider = (Deno.env.get('AI_PROVIDER') || 'gemini').toLowerCase();
  const text = provider === 'anthropic'
    ? await callClaude(fullPrompt, files)
    : await callGemini(fullPrompt, files, !!response_json_schema);
  return response_json_schema ? parseJson(text) : text.trim();
}
