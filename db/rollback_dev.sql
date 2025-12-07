-- ============================================================================
-- Rollback DEV — Fluxo7 Arena (Custom Auth + RLS corrigidas)
-- Objetivo: restaurar estrutura de usuarios, RPC de login custom (45 dias)
--           e políticas RLS consistentes com a estrutura atual (estruturabddev.csv).
--           O script é idempotente e remove policies antigas conflitando.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- Extensões necessárias (idempotentes)
-- --------------------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists pgjwt;

-- --------------------------------------------------------------------------
-- Helpers de claims tipados
-- --------------------------------------------------------------------------
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

create or replace function public.fx_claim_bigint(key text)
returns bigint language sql stable as $$
  select nullif(current_setting('request.jwt.claim.' || key, true), '')::bigint;
$$;

create or replace function public.app_user_papel()
returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.papel', true), '')::text;
$$;

-- --------------------------------------------------------------------------
-- Grants base
-- --------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant usage on schema public to anon;

-- --------------------------------------------------------------------------
-- Estrutura da tabela usuarios (custom auth)
-- --------------------------------------------------------------------------
alter table public.usuarios
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

-- Ajuste de default caso a coluna exista sem default
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='usuarios' and column_name='senha_alg'
       and column_default is null
  ) then
    execute 'alter table public.usuarios alter column senha_alg set default ''bcrypt''';
  end if;
end $$;

-- Remover possível FK antiga
alter table public.usuarios drop constraint if exists usuarios_id_fkey;

-- Índices
create index if not exists usuarios_email_lower_idx on public.usuarios (lower(email));
create index if not exists usuarios_empresa_email_idx on public.usuarios (codigo_empresa, lower(email));
create unique index if not exists usuarios_reset_token_unique on public.usuarios (reset_token) where reset_token is not null;

-- View segura (sem campos sensíveis)
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

-- --------------------------------------------------------------------------
-- RPC: auth_login_dev (JWT expira em 45 dias)
-- --------------------------------------------------------------------------
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

  v_secret := current_setting('app.settings.jwt_secret', true);
  if coalesce(v_secret, '') = '' then
    raise exception 'jwt secret not configured';
  end if;

  if crypt(p_password, v_user.senha_hash) = v_user.senha_hash then
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

-- --------------------------------------------------------------------------
-- Função utilitária para dropar TODAS as policies de uma tabela
-- --------------------------------------------------------------------------
create or replace function public.fx_drop_policies(p_table regclass)
returns void language plpgsql as $$
declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = split_part(p_table::text, '.', 2)
  loop
    execute format('drop policy if exists %I on %s', r.policyname, p_table);
  end loop;
end;$$;

-- --------------------------------------------------------------------------
-- RLS por empresa/usuário (DEV) — aplica após limpar policies existentes
-- Observado no CSV: codigo_empresa integer em: compras, estoque_reservado, comanda_historico.
-- Demais tabelas: codigo_empresa text/varchar.
-- --------------------------------------------------------------------------

-- empresas
grant select on public.empresas to authenticated;
alter table public.empresas enable row level security;
select public.fx_drop_policies('public.empresas');
create policy emp_select_company on public.empresas for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- produtos
grant select on public.produtos to authenticated;
alter table public.produtos enable row level security;
select public.fx_drop_policies('public.produtos');
create policy prod_select_company on public.produtos for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- produto_categorias (tem codigo_empresa)
grant select on public.produto_categorias to authenticated;
alter table public.produto_categorias enable row level security;
select public.fx_drop_policies('public.produto_categorias');
create policy pc_select_company on public.produto_categorias for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- clientes
grant select on public.clientes to authenticated;
alter table public.clientes enable row level security;
select public.fx_drop_policies('public.clientes');
create policy cli_select_company on public.clientes for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- vendas
grant select on public.vendas to authenticated;
alter table public.vendas enable row level security;
select public.fx_drop_policies('public.vendas');
create policy vend_select_company on public.vendas for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- colaboradores
grant select on public.colaboradores to authenticated;
alter table public.colaboradores enable row level security;
select public.fx_drop_policies('public.colaboradores');
create policy colab_select_company on public.colaboradores for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- agendamentos
grant select on public.agendamentos to authenticated;
alter table public.agendamentos enable row level security;
select public.fx_drop_policies('public.agendamentos');
create policy ag_select_company on public.agendamentos for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- agendamento_participantes
grant select on public.agendamento_participantes to authenticated;
alter table public.agendamento_participantes enable row level security;
select public.fx_drop_policies('public.agendamento_participantes');
create policy agp_select_company on public.agendamento_participantes for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- quadras (possui codigo_empresa TEXT)
grant select on public.quadras to authenticated;
alter table public.quadras enable row level security;
select public.fx_drop_policies('public.quadras');
create policy quad_select_company on public.quadras for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- quadras_dias_funcionamento (possui codigo_empresa TEXT e quadra_id)
grant select on public.quadras_dias_funcionamento to authenticated;
alter table public.quadras_dias_funcionamento enable row level security;
select public.fx_drop_policies('public.quadras_dias_funcionamento');
create policy qdf_select_company on public.quadras_dias_funcionamento for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- pagamentos (codigo_empresa TEXT)
grant select on public.pagamentos to authenticated;
alter table public.pagamentos enable row level security;
select public.fx_drop_policies('public.pagamentos');
create policy pag_select_company on public.pagamentos for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- finalizadoras (codigo_empresa TEXT)
grant select on public.finalizadoras to authenticated;
alter table public.finalizadoras enable row level security;
select public.fx_drop_policies('public.finalizadoras');
create policy fin_select_company on public.finalizadoras for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- comandas (codigo_empresa TEXT)
grant select on public.comandas to authenticated;
alter table public.comandas enable row level security;
select public.fx_drop_policies('public.comandas');
create policy cmd_select_company on public.comandas for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- comanda_itens (codigo_empresa TEXT)
grant select on public.comanda_itens to authenticated;
alter table public.comanda_itens enable row level security;
select public.fx_drop_policies('public.comanda_itens');
create policy ci_select_company on public.comanda_itens for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- comanda_clientes (codigo_empresa TEXT)
grant select on public.comanda_clientes to authenticated;
alter table public.comanda_clientes enable row level security;
select public.fx_drop_policies('public.comanda_clientes');
create policy cc_select_company on public.comanda_clientes for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- mesas (codigo_empresa TEXT)
grant select on public.mesas to authenticated;
alter table public.mesas enable row level security;
select public.fx_drop_policies('public.mesas');
create policy mesas_select_company on public.mesas for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- caixa_sessoes (codigo_empresa TEXT)
grant select on public.caixa_sessoes to authenticated;
alter table public.caixa_sessoes enable row level security;
select public.fx_drop_policies('public.caixa_sessoes');
create policy cs_select_company on public.caixa_sessoes for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- caixa_resumos (codigo_empresa TEXT)
grant select on public.caixa_resumos to authenticated;
alter table public.caixa_resumos enable row level security;
select public.fx_drop_policies('public.caixa_resumos');
create policy cr_select_company on public.caixa_resumos for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- caixa_movimentos (codigo_empresa TEXT)
grant select on public.caixa_movimentos to authenticated;
alter table public.caixa_movimentos enable row level security;
select public.fx_drop_policies('public.caixa_movimentos');
create policy cmov_select_company on public.caixa_movimentos for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- caixa_movimentacoes (codigo_empresa TEXT)
grant select on public.caixa_movimentacoes to authenticated;
alter table public.caixa_movimentacoes enable row level security;
select public.fx_drop_policies('public.caixa_movimentacoes');
create policy cm_select_company on public.caixa_movimentacoes for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- movimentos_saldo (codigo_empresa TEXT)
grant select on public.movimentos_saldo to authenticated;
alter table public.movimentos_saldo enable row level security;
select public.fx_drop_policies('public.movimentos_saldo');
create policy ms_select_company on public.movimentos_saldo for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- contas_pagar (codigo_empresa TEXT)
grant select on public.contas_pagar to authenticated;
alter table public.contas_pagar enable row level security;
select public.fx_drop_policies('public.contas_pagar');
create policy cp_select_company on public.contas_pagar for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- contas_pagar_baixas (via contas_pagar)
grant select on public.contas_pagar_baixas to authenticated;
alter table public.contas_pagar_baixas enable row level security;
select public.fx_drop_policies('public.contas_pagar_baixas');
create policy cpb_select_company on public.contas_pagar_baixas for select to authenticated
using (
  exists (
    select 1 from public.contas_pagar cp
     where cp.id = contas_pagar_baixas.conta_id
       and cp.codigo_empresa = public.fx_claim_text('codigo_empresa')
  )
);

-- contas_receber (codigo_empresa TEXT)
grant select on public.contas_receber to authenticated;
alter table public.contas_receber enable row level security;
select public.fx_drop_policies('public.contas_receber');
create policy cr_select_company on public.contas_receber for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- contas_receber_baixas (codigo_empresa TEXT)
grant select on public.contas_receber_baixas to authenticated;
alter table public.contas_receber_baixas enable row level security;
select public.fx_drop_policies('public.contas_receber_baixas');
create policy crb_select_company on public.contas_receber_baixas for select to authenticated
using (codigo_empresa = public.fx_claim_text('codigo_empresa'));

-- agenda_settings (empresa_id -> empresas)
grant select on public.agenda_settings to authenticated;
alter table public.agenda_settings enable row level security;
select public.fx_drop_policies('public.agenda_settings');
create policy as_select_company on public.agenda_settings for select to authenticated
using (
  exists (
    select 1 from public.empresas e
     where e.id = agenda_settings.empresa_id
       and e.codigo_empresa = public.fx_claim_text('codigo_empresa')
  )
);

-- compras (codigo_empresa INTEGER)
grant select on public.compras to authenticated;
alter table public.compras enable row level security;
select public.fx_drop_policies('public.compras');
create policy compras_select_company on public.compras for select to authenticated
using (codigo_empresa = public.fx_claim_int('codigo_empresa'));

-- compras_itens (via compras)
grant select on public.compras_itens to authenticated;
alter table public.compras_itens enable row level security;
select public.fx_drop_policies('public.compras_itens');
create policy ci_select_company on public.compras_itens for select to authenticated
using (
  exists (
    select 1 from public.compras c
     where c.id = compras_itens.compra_id
       and c.codigo_empresa = public.fx_claim_int('codigo_empresa')
  )
);

-- estoque_reservado (codigo_empresa INTEGER)
grant select on public.estoque_reservado to authenticated;
alter table public.estoque_reservado enable row level security;
select public.fx_drop_policies('public.estoque_reservado');
create policy er_select_company on public.estoque_reservado for select to authenticated
using (codigo_empresa = public.fx_claim_int('codigo_empresa'));

-- comanda_historico (codigo_empresa INTEGER)
grant select on public.comanda_historico to authenticated;
alter table public.comanda_historico enable row level security;
select public.fx_drop_policies('public.comanda_historico');
create policy ch_select_company on public.comanda_historico for select to authenticated
using (codigo_empresa = public.fx_claim_int('codigo_empresa'));

-- estoque_baixa_log (via comandas)
grant select on public.estoque_baixa_log to authenticated;
alter table public.estoque_baixa_log enable row level security;
select public.fx_drop_policies('public.estoque_baixa_log');
create policy ebl_select_company on public.estoque_baixa_log for select to authenticated
using (
  exists (
    select 1 from public.comandas c
     where c.id = estoque_baixa_log.comanda_id
       and c.codigo_empresa = public.fx_claim_text('codigo_empresa')
  )
);

-- user_ui_settings (por usuário)
grant select, insert, update on public.user_ui_settings to authenticated;
alter table public.user_ui_settings enable row level security;
select public.fx_drop_policies('public.user_ui_settings');
create policy uis_select_own on public.user_ui_settings for select to authenticated
using (user_id = public.app_user_id());
create policy uis_insert_own on public.user_ui_settings for insert to authenticated
with check (user_id = public.app_user_id());
create policy uis_update_own on public.user_ui_settings for update to authenticated
using (user_id = public.app_user_id())
with check (user_id = public.app_user_id());

-- Views (apenas GRANT SELECT)
grant select on public.v_agendamento_participantes to authenticated;
grant select on public.v_agendamentos_detalhado to authenticated;
grant select on public.v_agendamentos_isis to authenticated;
grant select on public.usuarios_safe to authenticated;

commit;

-- Recarregar schema do PostgREST
notify pgrst, 'reload schema';
