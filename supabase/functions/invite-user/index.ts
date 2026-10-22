import { serve, json, requireAdmin, serviceClient, HttpError } from '../_shared/http.ts';

const MAX_ADMINS = 4;

serve(async (req) => {
  await requireAdmin(req);
  const { email, role } = await req.json();
  if (!email) throw new HttpError(400, 'email é obrigatório');
  const finalRole = role === 'admin' ? 'admin' : 'user';
  const db = serviceClient();

  if (finalRole === 'admin') {
    const { count } = await db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
    if ((count || 0) >= MAX_ADMINS) throw new HttpError(400, `Limite de ${MAX_ADMINS} administradores atingido.`);
  }

  const origin = req.headers.get('origin') || undefined;
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: origin ? `${origin}/reset-password` : undefined,
  });
  if (error) throw new HttpError(400, error.message);

  // O perfil é criado pelo gatilho do banco como 'user'; aqui aplicamos o papel escolhido.
  await db.from('profiles').upsert({ id: data.user.id, email, role: finalRole });
  return json({ success: true });
});
