-- Auditoria de ações fiscais
create table if not exists public.auditoria_fiscal (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  codigo_empresa text not null,
  acao text not null, -- emitir|consultar|cancelar|inutilizar
  modelo text not null, -- 55 NF-e, 65 NFC-e
  comanda_id uuid null,
  nota_id uuid null,
  status text not null, -- start|success|error
  mensagem text null,
  request jsonb null,
  response jsonb null
);

-- Índices úteis
create index if not exists idx_aud_fiscal_empresa_data on public.auditoria_fiscal (codigo_empresa, criado_em desc);
create index if not exists idx_aud_fiscal_acao on public.auditoria_fiscal (acao);
create index if not exists idx_aud_fiscal_modelo on public.auditoria_fiscal (modelo);

-- RLS
alter table public.auditoria_fiscal enable row level security;

-- Função de empresa já existente no projeto
-- policy: apenas registros da mesma empresa
create policy if not exists aud_fiscal_select on public.auditoria_fiscal
  for select using (codigo_empresa = get_my_company_code());
create policy if not exists aud_fiscal_insert on public.auditoria_fiscal
  for insert with check (codigo_empresa = get_my_company_code());

-- Obs.: requer extensão pgcrypto para gen_random_uuid(); certifique-se que já está habilitada em setup.
