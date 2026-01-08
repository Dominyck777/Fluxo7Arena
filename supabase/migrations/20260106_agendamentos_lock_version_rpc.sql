-- Adds optimistic locking/versioning for agendamentos and provides an atomic RPC save for Agenda + PaymentModal

-- 1) Lock/version column
alter table public.agendamentos
  add column if not exists lock_version integer not null default 0;

-- 2) Auto-increment lock_version on every update
create or replace function public.agendamentos_increment_lock_version()
returns trigger
language plpgsql
as $$
begin
  new.lock_version := coalesce(old.lock_version, 0) + 1;
  return new;
end;
$$;

drop trigger if exists trg_agendamentos_lock_version on public.agendamentos;
create trigger trg_agendamentos_lock_version
before update on public.agendamentos
for each row
execute function public.agendamentos_increment_lock_version();

-- 3) Atomic save (agendamento + participantes) with optimistic locking
-- Params:
--  p_agendamento_id: booking id (required for now)
--  p_expected_lock_version: current client-side version
--  p_patch: jsonb with optional agendamentos fields (quadra_id, inicio, fim, modalidade, status, auto_disabled)
--  p_participants: jsonb array of participants in desired order, each item: { cliente_id, nome, valor_cota, status_pagamento, finalizadora_id, aplicar_taxa, is_representante }
create or replace function public.agenda_save_agendamento_v1(
  p_agendamento_id uuid,
  p_expected_lock_version integer,
  p_patch jsonb,
  p_participants jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo_empresa text;
  v_old public.agendamentos;
  v_new public.agendamentos;
  v_quadra_id uuid;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_modalidade text;
  v_status text;
  v_auto_disabled boolean;
  v_parts jsonb;
  v_rep_ord integer;
  v_cliente_id uuid;
  v_clientes text[];
  v_participants_out jsonb;
begin
  v_codigo_empresa := get_my_company_code();
  if v_codigo_empresa is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_agendamento_id is null then
    raise exception 'agendamento_id_required' using errcode = '22004';
  end if;

  select *
    into v_old
  from public.agendamentos
  where id = p_agendamento_id
    and codigo_empresa = v_codigo_empresa;

  if not found then
    raise exception 'agendamento_not_found' using errcode = 'P0002';
  end if;

  v_quadra_id := coalesce(nullif((p_patch->>'quadra_id'), '')::uuid, v_old.quadra_id);
  v_inicio := coalesce((p_patch->>'inicio')::timestamptz, v_old.inicio);
  v_fim := coalesce((p_patch->>'fim')::timestamptz, v_old.fim);
  v_modalidade := coalesce(p_patch->>'modalidade', v_old.modalidade);
  v_status := coalesce(p_patch->>'status', v_old.status);
  v_auto_disabled := coalesce((p_patch->>'auto_disabled')::boolean, v_old.auto_disabled);

  v_parts := coalesce(p_participants, '[]'::jsonb);

  select ord
    into v_rep_ord
  from jsonb_array_elements(v_parts) with ordinality as t(elem, ord)
  where coalesce((t.elem->>'is_representante')::boolean, false) = true
  order by ord
  limit 1;

  if v_rep_ord is null then
    v_rep_ord := 1;
  end if;

  select (t.elem->>'cliente_id')::uuid
    into v_cliente_id
  from jsonb_array_elements(v_parts) with ordinality as t(elem, ord)
  where ord = v_rep_ord
  limit 1;

  if v_cliente_id is null then
    select (t.elem->>'cliente_id')::uuid
      into v_cliente_id
    from jsonb_array_elements(v_parts) with ordinality as t(elem, ord)
    order by ord
    limit 1;
  end if;

  select array_agg(nullif(trim(t.elem->>'nome'), '')::text order by ord)
    into v_clientes
  from jsonb_array_elements(v_parts) with ordinality as t(elem, ord);

  update public.agendamentos
     set quadra_id = v_quadra_id,
         cliente_id = v_cliente_id,
         clientes = v_clientes,
         inicio = v_inicio,
         fim = v_fim,
         modalidade = v_modalidade,
         status = v_status,
         auto_disabled = v_auto_disabled
   where id = p_agendamento_id
     and codigo_empresa = v_codigo_empresa
     and lock_version = p_expected_lock_version
   returning *
    into v_new;

  if not found then
    raise exception 'lock_conflict' using errcode = '40001';
  end if;

  update public.agendamento_participantes
     set deleted_at = now(),
         is_representante = false
   where codigo_empresa = v_codigo_empresa
     and agendamento_id = p_agendamento_id
     and deleted_at is null;

  insert into public.agendamento_participantes (
    codigo_empresa,
    agendamento_id,
    cliente_id,
    nome,
    valor_cota,
    status_pagamento,
    finalizadora_id,
    aplicar_taxa,
    ordem,
    is_representante,
    deleted_at
  )
  select
    v_codigo_empresa,
    p_agendamento_id,
    (t.elem->>'cliente_id')::uuid,
    coalesce(nullif(trim(t.elem->>'nome'), ''), 'Cliente Consumidor'),
    coalesce((t.elem->>'valor_cota')::numeric, 0),
    coalesce((t.elem->>'status_pagamento')::payment_status, 'Pendente'::payment_status),
    nullif(t.elem->>'finalizadora_id', '')::uuid,
    coalesce((t.elem->>'aplicar_taxa')::boolean, false),
    t.ord,
    (t.ord = v_rep_ord),
    null
  from jsonb_array_elements(v_parts) with ordinality as t(elem, ord);

  select jsonb_agg(
           jsonb_build_object(
             'cliente_id', p.cliente_id,
             'nome', p.nome,
             'valor_cota', p.valor_cota,
             'status_pagamento', p.status_pagamento,
             'finalizadora_id', p.finalizadora_id,
             'aplicar_taxa', p.aplicar_taxa,
             'ordem', p.ordem,
             'is_representante', p.is_representante
           )
           order by p.ordem, p.id
         )
    into v_participants_out
  from public.agendamento_participantes p
  where p.codigo_empresa = v_codigo_empresa
    and p.agendamento_id = p_agendamento_id
    and p.deleted_at is null;

  return jsonb_build_object(
    'agendamento', jsonb_build_object(
      'id', v_new.id,
      'codigo', v_new.codigo,
      'codigo_empresa', v_new.codigo_empresa,
      'quadra_id', v_new.quadra_id,
      'cliente_id', v_new.cliente_id,
      'clientes', v_new.clientes,
      'inicio', v_new.inicio,
      'fim', v_new.fim,
      'modalidade', v_new.modalidade,
      'status', v_new.status,
      'auto_disabled', v_new.auto_disabled,
      'lock_version', v_new.lock_version
    ),
    'participants', coalesce(v_participants_out, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.agenda_save_agendamento_v1(uuid, integer, jsonb, jsonb) to authenticated;
