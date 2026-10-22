-- Pagaê: estrutura do banco (equivalente às "entities" do Base44).
-- Os nomes dos campos foram mantidos iguais aos do Base44 para facilitar a
-- migração dos dados e manter as telas sem alteração.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Usuários (admins e clientes com login). Espelha auth.users.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  cpf text,
  telefone text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- Usada pelas regras de acesso: o usuário logado é admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Tabelas de negócio
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  cpf text,
  telefone text,
  whatsapp text,
  email text,
  data_nascimento date,
  endereco text,
  foto_cpf_url text,
  foto_cnh_url text,
  foto_comprovante_residencia_url text,
  ultimo_acesso timestamptz,
  ativo boolean not null default true,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index customers_cpf_idx on public.customers (cpf);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  modelo text not null,
  placa text not null,
  ano_fabricacao numeric,
  ano_modelo text,
  cor text,
  status text not null default 'disponivel' check (status in ('disponivel', 'vendido', 'recebido_troca')),
  cliente_troca_id uuid references public.customers (id) on delete set null,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  numero_contrato text not null,
  origem_numero text,
  tipo_contrato text default 'venda' check (tipo_contrato in ('parcelado', 'sem_parcelamento', 'venda')),
  cliente_id uuid not null references public.customers (id) on delete restrict,
  veiculo_id uuid references public.vehicles (id) on delete set null,
  data_contrato text,
  valor_venda numeric not null,
  valor_emprestado numeric,
  juros_previstos numeric,
  regra_juros text,
  saldo_inicial numeric,
  saldo_inicial_data text,
  recebimentos_historicos numeric,
  proximo_vencimento text,
  sinalizacoes text,
  entrada_dinheiro numeric default 0,
  veiculo_troca_id uuid references public.vehicles (id) on delete set null,
  veiculo_troca_descricao text,
  veiculo_troca_valor numeric default 0,
  saldo_parcelado numeric,
  quantidade_parcelas numeric,
  valor_parcela numeric,
  descricao text,
  observacoes text,
  foto_url text,
  foto_carro_vendido_url text,
  foto_carro_troca_url text,
  status text not null default 'ativo' check (status in ('ativo', 'quitado', 'renegociado')),
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index sales_cliente_idx on public.sales (cliente_id);
create index sales_origem_idx on public.sales (origem_numero);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.sales (id) on delete cascade,
  cliente_id uuid not null references public.customers (id) on delete restrict,
  numero numeric not null,
  valor numeric,
  valor_indisponivel boolean default false,
  vencimento date not null,
  status text not null default 'aberta' check (status in ('aberta', 'paga', 'atrasada', 'em_analise', 'parcial')),
  valor_pago numeric default 0,
  data_pagamento text,
  data_confirmacao text,
  conferido_por text,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index installments_venda_idx on public.installments (venda_id);
create index installments_cliente_idx on public.installments (cliente_id);

create table public.payment_reports (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid references public.installments (id) on delete set null,
  venda_id uuid references public.sales (id) on delete set null,
  cliente_id uuid not null references public.customers (id) on delete restrict,
  valor_informado numeric not null,
  data_pagamento text,
  origem text default 'aplicativo' check (origem in ('aplicativo', 'whatsapp', 'manual')),
  comprovante_url text,
  tem_comprovante boolean default false,
  status text not null default 'informado' check (status in ('informado', 'em_analise', 'confirmado', 'recusado', 'divergencia')),
  dados_ia_pagador text,
  dados_ia_recebedor text,
  dados_ia_valor numeric,
  dados_ia_data text,
  dados_ia_banco text,
  dados_ia_transacao_id text,
  dados_ia_status text,
  ia_match_score numeric,
  ia_duvidas text,
  conta_recebedora text,
  conferido_por text,
  data_conferencia text,
  justificativa text,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index payment_reports_cliente_idx on public.payment_reports (cliente_id);
create index payment_reports_status_idx on public.payment_reports (status);

create table public.pix_keys (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  chave text not null,
  titular text not null,
  banco text not null,
  ativo boolean not null default false,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  ativo boolean not null default true,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table public.admin_cpfs (
  id uuid primary key default gen_random_uuid(),
  cpf text not null,
  nome text,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  acao text not null,
  entidade text not null,
  entidade_id text,
  detalhes text,
  usuario_nome text,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid references public.sales (id) on delete cascade,
  cliente_id uuid references public.customers (id) on delete set null,
  arquivo_uri text not null,
  nome_arquivo text not null,
  numero_documento text,
  numero_contrato text,
  data_geracao text,
  tipo text check (tipo in ('comprovante_pagamento', 'resumo_parcelado', 'resumo_sem_parcelamento', 'outro')),
  dados_extraidos text,
  status text default 'importado' check (status in ('revisao', 'importado')),
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_date automático e created_by = e-mail de quem criou
-- ---------------------------------------------------------------------------
create or replace function public.touch_row()
returns trigger
language plpgsql
as $$
begin
  new.updated_date := now();
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := coalesce(auth.jwt() ->> 'email', 'sistema');
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['customers','vehicles','sales','installments','payment_reports',
                           'pix_keys','whatsapp_contacts','admin_cpfs','audit_logs','contract_documents']
  loop
    execute format('create trigger %I_touch before insert or update on public.%I for each row execute function public.touch_row()', t, t);
  end loop;
end $$;

create or replace function public.touch_profile()
returns trigger
language plpgsql
as $$
begin
  new.updated_date := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_profile();

-- ---------------------------------------------------------------------------
-- Novo usuário: cria o perfil e liga ao cadastro de cliente pelo CPF.
-- O papel sempre começa como 'user'; só um admin promove alguém a admin.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cpf text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '\D', '', 'g');
  v_tel text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefone', ''), '\D', '', 'g');
  v_nome text := nullif(new.raw_user_meta_data ->> 'full_name', '');
begin
  insert into public.profiles (id, email, full_name, cpf, telefone)
  values (new.id, new.email, v_nome, nullif(v_cpf, ''), nullif(v_tel, ''))
  on conflict (id) do nothing;

  if length(v_cpf) = 11 then
    if exists (select 1 from public.customers where cpf = v_cpf) then
      -- Só completa o e-mail se o telefone conferir (ou o cadastro não tiver telefone).
      update public.customers
         set email = new.email
       where cpf = v_cpf
         and (coalesce(nullif(whatsapp, ''), nullif(telefone, '')) is null
              or coalesce(nullif(whatsapp, ''), telefone) = v_tel);
    elsif v_nome is not null then
      insert into public.customers (nome_completo, cpf, telefone, whatsapp, email, ativo, created_by)
      values (v_nome, v_cpf, nullif(v_tel, ''), nullif(v_tel, ''), new.email, true, 'cadastro');
    end if;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Regras de acesso (RLS): o painel é só para admins. O portal do cliente
-- passa pelas Edge Functions, que validam a sessão assinada do cliente.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "ver o próprio perfil" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "admin altera perfis" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['customers','vehicles','sales','installments','payment_reports',
                           'pix_keys','whatsapp_contacts','admin_cpfs','audit_logs','contract_documents']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admin acesso total" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- O histórico de auditoria não deve ser apagado nem editado.
drop policy "admin acesso total" on public.audit_logs;
create policy "admin lê auditoria" on public.audit_logs for select using (public.is_admin());
create policy "admin registra auditoria" on public.audit_logs for insert with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Arquivos privados (documentos, comprovantes, promissórias)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('private-files', 'private-files', false)
on conflict (id) do nothing;

create policy "admin envia arquivos" on storage.objects for insert
  with check (bucket_id = 'private-files' and public.is_admin());
create policy "admin lê arquivos" on storage.objects for select
  using (bucket_id = 'private-files' and public.is_admin());
create policy "admin apaga arquivos" on storage.objects for delete
  using (bucket_id = 'private-files' and public.is_admin());
