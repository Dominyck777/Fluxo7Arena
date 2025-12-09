-- Tabela de Notas Fiscais (modelo 55)
-- Armazena NF-e criadas manualmente ou a partir de comandas

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

-- Índices úteis
create index if not exists idx_notas_fiscais_empresa on public.notas_fiscais (codigo_empresa);
create index if not exists idx_notas_fiscais_status on public.notas_fiscais (status);
create index if not exists idx_notas_fiscais_criado_em on public.notas_fiscais (criado_em desc);

-- Trigger de updated_at
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

-- RLS
alter table public.notas_fiscais enable row level security;

-- Políticas por empresa (usa função existente get_my_company_code())
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

-- Permissões básicas (Supabase aplica via policies)
grant select, insert, update, delete on public.notas_fiscais to anon, authenticated;
