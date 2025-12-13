-- ============================================================================
-- Fluxo7 Arena — Consolidado de SQL para aplicar no MAIN
-- Objetivo: alinhar MAIN com as mudanças usadas na branch DEV (RLS, Realtime,
--           indices, auth utilitária, e tabela fiscal notas_fiscais).
-- Características: idempotente (usa IF NOT EXISTS / DROP IF EXISTS quando cabível)
-- Pré-requisitos: executar com um usuário com permissões de owner no schema public.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Extensões necessárias (idempotentes)
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists pgjwt;

-- ---------------------------------------------------------------------------
-- Helpers de claims e utilitários de JWT (idempotentes)
-- ---------------------------------------------------------------------------
create or replace function public.app_user_id()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function public.fx_claim_text(key text)
returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.' || key, true), '')::text;
$$;

create or replace function public.fx_claim_int(key text)
returns integer language sql stable as $$
  select nullif(current_setting('request.jwt.claim.' || key, true), '')::integer;
$$;

-- Compatibilidade com migrações que usam get_my_company_code()
create or replace function public.get_my_company_code()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb->>'codigo_empresa',
                  current_setting('request.jwt.claim.codigo_empresa', true),
                  '')::text;
$$;

-- ---------------------------------------------------------------------------
-- Grants base no schema public
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant usage on schema public to anon;

-- ---------------------------------------------------------------------------
-- Ajustes da tabela usuarios e RPC de login DEV (opcional em produção)
-- ---------------------------------------------------------------------------
alter table if exists public.usuarios
  add column if not exists nome                   varchar(255),
  add column if not exists email                  varchar(255),
  add column if not exists papel                  varchar(50) default 'user',
  add column if not exists criado_em              timestamptz default now(),
  add column if not exists atualizado_em          timestamptz default now(),
  add column if not exists codigo_empresa         varchar(10),
  add column if not exists senha_hash             text,
  add column if not exists senha_alg              text default 'bcrypt',
  add column if not exists senha_atualizada_em    timestamptz default now(),
  add column if not exists reset_token            text,
  add column if not exists reset_token_expires_at timestamptz,
  add column if not exists tentativas_invalidas   integer default 0,
  add column if not exists login_bloqueado        boolean default false,
  add column if not exists last_login_at          timestamptz,
  add column if not exists force_password_reset   boolean default false;

-- Garantir default da coluna senha_alg
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='usuarios' and column_name='senha_alg'
       and column_default is null
  ) then
    execute 'alter table public.usuarios alter column senha_alg set default ''bcrypt''';
  end if;
end $$;

-- Remover possível FK legado
alter table if exists public.usuarios drop constraint if exists usuarios_id_fkey;

-- Índices úteis
create index if not exists usuarios_email_lower_idx on public.usuarios (lower(email));
create index if not exists usuarios_empresa_email_idx on public.usuarios (codigo_empresa, lower(email));
create unique index if not exists usuarios_reset_token_unique on public.usuarios (reset_token) where reset_token is not null;

-- RPC de login custom (dev/qa). Se não quiser em produção, comentar este bloco.
drop function if exists public.auth_login_dev(text, text);
create or replace function public.auth_login_dev(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
  v_now timestamptz := now();
  v_exp_seconds integer := 60*60*24*45; -- 45 dias
  v_secret text;
  v_token text;
begin
  select u.* into v_user
    from public.usuarios u
   where lower(u.email) = lower(p_email)
   limit 1;

  if v_user is null or v_user.senha_hash is null then
    raise exception 'invalid credentials';
  end if;

  if coalesce(v_user.login_bloqueado, false) then
    raise exception 'user blocked';
  end if;

  if crypt(p_password, v_user.senha_hash) = v_user.senha_hash then
    v_secret := current_setting('app.settings.jwt_secret', true);
    if coalesce(v_secret, '') = '' then
      raise exception 'jwt secret not configured';
    end if;

    v_token := sign(
      json_build_object(
        'aud','authenticated',
        'iss','supabase',
        'sub', v_user.id::text,
        'role','authenticated',
        'email', v_user.email,
        'papel', coalesce(v_user.papel,'user'),
        'codigo_empresa', v_user.codigo_empresa,
        'iat', extract(epoch from v_now)::int,
        'exp', extract(epoch from (v_now + make_interval(secs => v_exp_seconds)))::int
      ),
      v_secret
    );

    update public.usuarios
       set last_login_at = v_now,
           tentativas_invalidas = 0,
           atualizado_em = v_now
     where id = v_user.id;

    return jsonb_build_object(
      'access_token', v_token,
      'user', jsonb_build_object(
        'id', v_user.id,
        'nome', v_user.nome,
        'email', v_user.email,
        'papel', v_user.papel,
        'codigo_empresa', v_user.codigo_empresa
      )
    );
  else
    update public.usuarios
       set tentativas_invalidas = coalesce(tentativas_invalidas,0) + 1,
           atualizado_em = v_now
     where id = v_user.id;
    raise exception 'invalid credentials';
  end if;
end;
$$;

grant execute on function public.auth_login_dev(text, text) to anon, authenticated;

-- View sem campos sensíveis
create or replace view public.usuarios_safe as
select
  u.id,
  u.nome,
  u.email,
  u.papel,
  u.codigo_empresa,
  u.criado_em,
  u.atualizado_em,
  u.last_login_at,
  u.senha_atualizada_em,
  u.login_bloqueado,
  u.tentativas_invalidas,
  u.force_password_reset
from public.usuarios u;

-- ---------------------------------------------------------------------------
-- Tabela Fiscal: notas_fiscais (modelo 55) + RLS
-- (igual à migration supabase/migrations/20251208_create_notas_fiscais.sql)
-- ---------------------------------------------------------------------------
create table if not exists public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  codigo_empresa text not null,
  origem text not null check (origem in ('comanda','manual')),
  comanda_id uuid null,
  modelo text not null default '55',
  numero integer null,
  serie integer null,
  status text not null default 'pendente', -- pendente | processando | autorizada | rejeitada | cancelada
  chave text null,
  xml_url text null,
  pdf_url text null,
  valor_total numeric(12,2) null,
  destinatario jsonb null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_notas_fiscais_empresa on public.notas_fiscais (codigo_empresa);
create index if not exists idx_notas_fiscais_status on public.notas_fiscais (status);
create index if not exists idx_notas_fiscais_criado_em on public.notas_fiscais (criado_em desc);

drop function if exists public._set_updated_at();
create or replace function public._set_updated_at()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end; $$;

drop trigger if exists trg_notas_fiscais_updated_at on public.notas_fiscais;
create trigger trg_notas_fiscais_updated_at
before update on public.notas_fiscais
for each row execute function public._set_updated_at();

alter table public.notas_fiscais enable row level security;

drop policy if exists notas_fiscais_select on public.notas_fiscais;
create policy notas_fiscais_select on public.notas_fiscais
for select using (codigo_empresa = get_my_company_code());

drop policy if exists notas_fiscais_insert on public.notas_fiscais;
create policy notas_fiscais_insert on public.notas_fiscais
for insert with check (codigo_empresa = get_my_company_code());

drop policy if exists notas_fiscais_update on public.notas_fiscais;
create policy notas_fiscais_update on public.notas_fiscais
for update using (codigo_empresa = get_my_company_code())
with check (codigo_empresa = get_my_company_code());

drop policy if exists notas_fiscais_delete on public.notas_fiscais;
create policy notas_fiscais_delete on public.notas_fiscais
for delete using (codigo_empresa = get_my_company_code());

grant select, insert, update, delete on public.notas_fiscais to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Loja (Mesas/Comandas/Balcão/Pagamentos/Produtos): Realtime + RLS + Índices
-- ---------------------------------------------------------------------------
-- Publicação Realtime (idempotente)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Adicionar tabelas na publicação
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='comandas'
  ) then
    execute 'alter publication supabase_realtime add table public.comandas';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='comanda_itens'
  ) then
    execute 'alter publication supabase_realtime add table public.comanda_itens';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='comanda_clientes'
  ) then
    execute 'alter publication supabase_realtime add table public.comanda_clientes';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='mesas'
  ) then
    execute 'alter publication supabase_realtime add table public.mesas';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='pagamentos'
  ) then
    execute 'alter publication supabase_realtime add table public.pagamentos';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='produtos'
  ) then
    execute 'alter publication supabase_realtime add table public.produtos';
  end if;
end $$;

-- Replica identity FULL
alter table if exists public.comandas            replica identity full;
alter table if exists public.comanda_itens       replica identity full;
alter table if exists public.comanda_clientes    replica identity full;
alter table if exists public.mesas               replica identity full;
alter table if exists public.pagamentos          replica identity full;
alter table if exists public.produtos            replica identity full;

-- Habilitar RLS
alter table if exists public.comandas            enable row level security;
alter table if exists public.comanda_itens       enable row level security;
alter table if exists public.comanda_clientes    enable row level security;
alter table if exists public.mesas               enable row level security;
alter table if exists public.pagamentos          enable row level security;
alter table if exists public.produtos            enable row level security;

-- Policies SELECT por empresa (claim 'codigo_empresa' como TEXT)
drop policy if exists cmd_select_company on public.comandas;
create policy cmd_select_company on public.comandas for select to authenticated
  using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

drop policy if exists ci_select_company on public.comanda_itens;
create policy ci_select_company on public.comanda_itens for select to authenticated
  using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

drop policy if exists cc_select_company on public.comanda_clientes;
create policy cc_select_company on public.comanda_clientes for select to authenticated
  using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

drop policy if exists mesas_select_company on public.mesas;
create policy mesas_select_company on public.mesas for select to authenticated
  using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

drop policy if exists pag_select_company on public.pagamentos;
create policy pag_select_company on public.pagamentos for select to authenticated
  using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

drop policy if exists prod_select_company on public.produtos;
create policy prod_select_company on public.produtos for select to authenticated
  using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

drop policy if exists fin_select_company on public.finalizadoras;
create policy fin_select_company on public.finalizadoras for select to authenticated
  using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- Índices auxiliares
create index if not exists comandas_empresa_idx           on public.comandas (codigo_empresa);
create index if not exists comandas_mesa_idx              on public.comandas (mesa_id);
create index if not exists comanda_itens_empresa_idx      on public.comanda_itens (codigo_empresa);
create index if not exists comanda_itens_comanda_idx      on public.comanda_itens (comanda_id);
create index if not exists comanda_clientes_empresa_idx   on public.comanda_clientes (codigo_empresa);
create index if not exists comanda_clientes_comanda_idx   on public.comanda_clientes (comanda_id);
create index if not exists mesas_empresa_idx              on public.mesas (codigo_empresa);
create index if not exists pagamentos_empresa_idx         on public.pagamentos (codigo_empresa);
create index if not exists pagamentos_comanda_idx         on public.pagamentos (comanda_id);
create index if not exists produtos_empresa_idx           on public.produtos (codigo_empresa);

-- ---------------------------------------------------------------------------
-- Compras (integer) e relacionados
-- ---------------------------------------------------------------------------
-- compras (codigo_empresa: integer)
alter table if exists public.compras enable row level security;
drop policy if exists compras_select_company on public.compras;
create policy compras_select_company on public.compras for select to authenticated
  using (codigo_empresa = public.fx_claim_int('codigo_empresa'));

-- compras_itens (relacionado a compras)
alter table if exists public.compras_itens enable row level security;
drop policy if exists ci_select_company on public.compras_itens;
create policy ci_select_company on public.compras_itens for select to authenticated
  using (
    exists (
      select 1 from public.compras c
       where c.id = compras_itens.compra_id
         and c.codigo_empresa = public.fx_claim_int('codigo_empresa')
    )
  );

-- estoque_reservado (integer)
alter table if exists public.estoque_reservado enable row level security;
drop policy if exists er_select_company on public.estoque_reservado;
create policy er_select_company on public.estoque_reservado for select to authenticated
  using (codigo_empresa = public.fx_claim_int('codigo_empresa'));

-- comanda_historico (integer)
alter table if exists public.comanda_historico enable row level security;
drop policy if exists ch_select_company on public.comanda_historico;
create policy ch_select_company on public.comanda_historico for select to authenticated
  using (codigo_empresa = public.fx_claim_int('codigo_empresa'));

-- estoque_baixa_log (relaciona em comandas)
alter table if exists public.estoque_baixa_log enable row level security;
drop policy if exists ebl_select_company on public.estoque_baixa_log;
create policy ebl_select_company on public.estoque_baixa_log for select to authenticated
  using (
    exists (
      select 1 from public.comandas c
       where c.id = estoque_baixa_log.comanda_id
         and c.codigo_empresa = public.fx_claim_text('codigo_empresa')
    )
  );

-- agenda_settings (empresa_id -> empresas)
alter table if exists public.agenda_settings enable row level security;
drop policy if exists as_select_company on public.agenda_settings;
create policy as_select_company on public.agenda_settings for select to authenticated
  using (
    exists (
      select 1 from public.empresas e
       where e.id = agenda_settings.empresa_id
         and e.codigo_empresa = public.fx_claim_text('codigo_empresa')
    )
  );

-- ---------------------------------------------------------------------------
-- RLS adicionais usados na Ísis (público anon para leitura/cadastro público)
-- Ajuste conforme necessidade do ambiente MAIN
-- ---------------------------------------------------------------------------
-- clientes: leitura/criação pública (se necessário para fluxo público)
alter table if exists public.clientes enable row level security;
drop policy if exists "Isis pode buscar clientes" on public.clientes;
create policy "Isis pode buscar clientes" on public.clientes for select to anon, authenticated using (true);

drop policy if exists "Isis pode criar clientes" on public.clientes;
create policy "Isis pode criar clientes" on public.clientes for insert to anon, authenticated with check (true);

-- quadras_dias_funcionamento: leitura pública (consulta disponibilidade)
alter table if exists public.quadras_dias_funcionamento enable row level security;
drop policy if exists "Isis pode ler dias funcionamento" on public.quadras_dias_funcionamento;
create policy "Isis pode ler dias funcionamento" on public.quadras_dias_funcionamento for select to anon, authenticated using (codigo_empresa is not null);

-- quadras: leitura pública (se necessário ao fluxo)
alter table if exists public.quadras enable row level security;
drop policy if exists "Isis pode ler quadras" on public.quadras;
create policy "Isis pode ler quadras" on public.quadras for select to anon, authenticated using (codigo_empresa is not null);

-- usuarios: políticas de autoacesso
alter table if exists public.usuarios enable row level security;
drop policy if exists "Usuarios podem ler seus proprios dados" on public.usuarios;
create policy "Usuarios podem ler seus proprios dados" on public.usuarios for select using (id = auth.uid());

drop policy if exists "Usuarios podem atualizar seus proprios dados" on public.usuarios;
create policy "Usuarios podem atualizar seus proprios dados" on public.usuarios for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- empresa_counters: RLS e (opcional) seed por empresa
-- ATENÇÃO: ajuste 'COD_EMPRESA_AQUI' antes de executar a parte de SEED
-- ---------------------------------------------------------------------------
alter table if exists public.empresa_counters enable row level security;

-- Exemplo de políticas por relacionamento com empresas/usuarios (mais restritivas)
drop policy if exists "Usuarios podem ler counters da propria empresa" on public.empresa_counters;
create policy "Usuarios podem ler counters da propria empresa" on public.empresa_counters for select using (
  empresa_id in (
    select e.id from public.empresas e
    join public.usuarios u on u.codigo_empresa = e.codigo_empresa
    where u.id = auth.uid()
  )
);

drop policy if exists "Usuarios podem atualizar counters da propria empresa" on public.empresa_counters;
create policy "Usuarios podem atualizar counters da propria empresa" on public.empresa_counters for update using (
  empresa_id in (
    select e.id from public.empresas e
    join public.usuarios u on u.codigo_empresa = e.codigo_empresa
    where u.id = auth.uid()
  )
) with check (
  empresa_id in (
    select e.id from public.empresas e
    join public.usuarios u on u.codigo_empresa = e.codigo_empresa
    where u.id = auth.uid()
  )
);

drop policy if exists "Usuarios podem criar counters da propria empresa" on public.empresa_counters;
create policy "Usuarios podem criar counters da propria empresa" on public.empresa_counters for insert with check (
  empresa_id in (
    select e.id from public.empresas e
    join public.usuarios u on u.codigo_empresa = e.codigo_empresa
    where u.id = auth.uid()
  )
);

-- (Opcional) Seed/ajuste do próximo código com base no maior existente
-- Substitua 'COD_EMPRESA_AQUI' pelo código da empresa (ex.: '1005')
-- delete from public.empresa_counters where empresa_id in (select id from public.empresas where codigo_empresa = 'COD_EMPRESA_AQUI');
-- insert into public.empresa_counters (empresa_id, next_cliente_codigo, next_agendamento_codigo)
-- select e.id, coalesce(max(c.codigo),0)+1, 1
-- from public.empresas e
-- left join public.clientes c on c.codigo_empresa = e.codigo_empresa
-- where e.codigo_empresa = 'COD_EMPRESA_AQUI'
-- group by e.id;

commit;

-- Recarregar o schema do PostgREST (após commit)
notify pgrst, 'reload schema';

-- ============================================================================
-- Verificações úteis (rodar conforme necessário)
-- ============================================================================
-- Políticas por tabela
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check from pg_policies order by tablename, policyname;

-- Tabelas com RLS habilitado
-- select schemaname, tablename, rowsecurity from pg_tables where schemaname='public' and rowsecurity = true order by tablename;

-- Publicação Realtime
-- select * from pg_publication where pubname = 'supabase_realtime';
-- select * from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;
