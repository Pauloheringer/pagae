// Camada de compatibilidade: as telas foram escritas para o SDK do Base44
// (`base44.entities.X.list()`, `base44.auth.me()`, ...). Este arquivo oferece a
// mesma interface usando Supabase, para que as telas continuem iguais.

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, PRIVATE_BUCKET } from './supabaseClient';

const TABLES = {
  Customer: 'customers',
  Installment: 'installments',
  AdminCpf: 'admin_cpfs',
  PixKey: 'pix_keys',
  Sale: 'sales',
  WhatsAppContact: 'whatsapp_contacts',
  AuditLog: 'audit_logs',
  Vehicle: 'vehicles',
  PaymentReport: 'payment_reports',
  ContractDocument: 'contract_documents',
  User: 'profiles',
};

// Base44 aceitava "" em campos de data e número; o Postgres não.
function clean(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined) continue;
    if (k === 'id' || k === 'created_date' || k === 'updated_date') continue;
    out[k] = v === '' ? null : v;
  }
  return out;
}

function fail(error) {
  if (!error) return;
  const e = new Error(error.message || 'Erro no banco de dados');
  e.details = error;
  throw e;
}

function applySort(query, sort) {
  if (!sort) return query.order('created_date', { ascending: false });
  const desc = sort.startsWith('-');
  return query.order(desc ? sort.slice(1) : sort, { ascending: !desc, nullsFirst: false });
}

function entity(table) {
  return {
    async list(sort, limit) {
      let q = applySort(supabase.from(table).select('*'), sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      fail(error);
      return data;
    },
    async filter(where = {}, sort, limit) {
      let q = supabase.from(table).select('*');
      for (const [k, v] of Object.entries(where)) {
        if (v && typeof v === 'object' && Array.isArray(v.$in)) q = q.in(k, v.$in);
        else if (v === null) q = q.is(k, null);
        else q = q.eq(k, v);
      }
      q = applySort(q, sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      fail(error);
      return data;
    },
    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      fail(error);
      if (!data) throw new Error('Registro não encontrado');
      return data;
    },
    async create(row) {
      const { data, error } = await supabase.from(table).insert(clean(row)).select().single();
      fail(error);
      return data;
    },
    async bulkCreate(rows) {
      if (!rows?.length) return [];
      const { data, error } = await supabase.from(table).insert(rows.map(clean)).select();
      fail(error);
      return data;
    },
    async update(id, changes) {
      const { data, error } = await supabase.from(table).update(clean(changes)).eq('id', id).select().maybeSingle();
      fail(error);
      return data;
    },
    async bulkUpdate(rows) {
      return Promise.all(rows.map(({ id, ...changes }) => this.update(id, changes)));
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      fail(error);
    },
  };
}

const entities = Object.fromEntries(Object.entries(TABLES).map(([name, table]) => [name, entity(table)]));

// Chama uma Edge Function do Supabase. Os erros imitam o formato do SDK do
// Base44 (`e.response.data.error`), que as telas já tratam.
export async function invokeFunction(name, body, { formData } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
  };
  if (!formData) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: formData || JSON.stringify(body || {}),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const e = new Error(data?.error || `Erro ${res.status}`);
    e.response = { status: res.status, data: data || {} };
    throw e;
  }
  return { data };
}

function uniquePath(prefix, file) {
  const safe = (file.name || 'arquivo').normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
  return `${prefix}/${crypto.randomUUID()}-${safe}`;
}

const integrations = {
  Core: {
    // Arquivo privado (documentos, comprovantes). Devolve um "file_uri"
    // no formato bucket/caminho, guardado no banco como no Base44.
    async UploadPrivateFile({ file }) {
      const path = uniquePath('uploads', file);
      const { error } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, { contentType: file.type });
      fail(error);
      return { file_uri: `${PRIVATE_BUCKET}/${path}` };
    },
    // Upload feito pelo cliente no portal (sem login do Supabase), validado
    // pela sessão assinada do portal.
    async UploadPortalFile({ file, session }) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('session', session);
      const res = await invokeFunction('portal-upload', null, { formData: fd });
      return res.data;
    },
    async CreateFileSignedUrl({ file_uri, expires_in = 300 }) {
      const [bucket, ...rest] = String(file_uri).split('/');
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(rest.join('/'), expires_in);
      fail(error);
      return { signed_url: data.signedUrl };
    },
    async InvokeLLM(params) {
      const res = await invokeFunction('invoke-llm', params);
      return res.data.result;
    },
  },
};

async function currentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    const e = new Error('Não autenticado');
    e.status = 401;
    throw e;
  }
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name || user.user_metadata?.full_name || '',
    role: profile?.role || 'user',
    cpf: profile?.cpf || '',
    telefone: profile?.telefone || '',
  };
}

const auth = {
  me: currentUser,
  async loginViaEmailPassword(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha inválidos' : error.message);
  },
  async register({ email, password, full_name, cpf, telefone }) {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name, cpf, telefone } },
    });
    fail(error);
  },
  async verifyOtp({ email, otpCode }) {
    const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
    if (error) throw new Error('Código inválido ou expirado');
  },
  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    fail(error);
  },
  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    fail(error);
  },
  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    fail(error);
  },
  async logout(redirectTo) {
    await supabase.auth.signOut();
    if (redirectTo) window.location.href = '/login';
  },
  redirectToLogin() {
    window.location.href = '/login';
  },
};

const users = {
  async inviteUser(email, role) {
    await invokeFunction('invite-user', { email, role });
  },
};

export const base44 = { entities, integrations, auth, users };
