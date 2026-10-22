import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Cliente com a chave de serviço: ignora RLS. Use só depois de validar quem chama. */
export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

export type AppUser = { id: string; email: string; role: string; full_name: string | null };

/** Usuário logado (admin ou não), a partir do token do painel. Null se não houver. */
export async function getUser(req: Request): Promise<AppUser | null> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const db = serviceClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await db.from('profiles').select('role, full_name').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: data.user.email || '', role: profile?.role || 'user', full_name: profile?.full_name || null };
}

export async function requireAdmin(req: Request): Promise<AppUser> {
  const user = await getUser(req);
  if (!user) throw new HttpError(401, 'Não autenticado');
  if (user.role !== 'admin') throw new HttpError(403, 'Acesso restrito a administradores');
  return user;
}

/** Envolve o handler com CORS e tratamento de erro. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      return await handler(req);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error(error);
      return json({ error: (error as Error).message || 'Erro interno' }, 500);
    }
  });
}
