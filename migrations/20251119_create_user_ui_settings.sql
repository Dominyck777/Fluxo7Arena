-- Tabela de configurações de UI por usuário/escopo
create table if not exists user_ui_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_ui_settings_pkey primary key (user_id, scope)
);

alter table user_ui_settings enable row level security;

create policy if not exists "Users can manage own ui settings"
  on user_ui_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
