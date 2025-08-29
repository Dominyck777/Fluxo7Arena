# Tutorial: Criar uma nova empresa e vincular usuário (Supabase)

Este guia mostra como criar uma empresa e vincular um usuário para login na aplicação.

Importante:
- Primeiro crie o usuário no Supabase Auth (email e senha). Depois rode o SQL abaixo para vincular esse usuário à empresa.
- O script SQL é idempotente (pode rodar mais de uma vez sem duplicar dados) e cobre:
  - Criação/atualização da empresa (`public.empresas`)
  - Criação/atualização do usuário do sistema (`public.usuarios`) com o mesmo `id` do Auth
  - Criação/atualização do colaborador (`public.colaboradores`) com o mesmo `id` do Auth

## Passo 0 — Criar usuário no Auth
1. No Supabase Studio: Auth → Users → Add User (ou convide o e-mail)
2. Anote o e-mail do usuário (ex.: `admin@empresa.com`).

## Passo 1 — Rodar o SQL único de criação/vínculo
- Abra o SQL Editor do Supabase e ajuste as variáveis no topo do script.
- Execute o script inteiro.

```sql
-- Script único para criar empresa e vincular usuário/colaborador
-- Ajuste os parâmetros abaixo conforme necessário

DO $$
DECLARE
  v_codigo_empresa   text   := '777';                -- código único da empresa
  v_nome             text   := 'Minha Arena';         -- nome (obrigatório na sua tabela)
  v_nome_fantasia    text   := 'Minha Arena';        -- nome fantasia da empresa
  v_razao_social     text   := 'Minha Arena LTDA';   -- razão social (opcional)
  v_email            text   := 'admin@empresa.com';  -- e-mail do usuário já criado no AUTH
  v_nome_usuario     text   := 'Admin';              -- nome da pessoa
  v_papel_usuario    text   := 'admin';              -- papel/cargo (livre)
  v_ativo_colab      boolean := true;                -- colaborador ativo

  v_user_id uuid;
  v_emp_id uuid;
BEGIN
  -- 1) Obter o id do usuário no Auth a partir do e-mail
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário Auth não encontrado para o e-mail: % (crie o usuário no Auth antes)', v_email;
  END IF;

  -- 2) Upsert da empresa por codigo_empresa (inclui coluna obrigatória 'nome')
  INSERT INTO public.empresas (codigo_empresa, nome, nome_fantasia, razao_social)
  VALUES (v_codigo_empresa, v_nome, v_nome_fantasia, v_razao_social)
  ON CONFLICT (codigo_empresa) DO UPDATE
    SET nome          = EXCLUDED.nome,
        nome_fantasia = EXCLUDED.nome_fantasia,
        razao_social  = EXCLUDED.razao_social;

  -- Recuperar id (opcional)
  SELECT id INTO v_emp_id
  FROM public.empresas
  WHERE codigo_empresa = v_codigo_empresa
  LIMIT 1;

  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao obter empresa para codigo_empresa=%', v_codigo_empresa;
  END IF;

  -- 3) Upsert em public.usuarios usando o MESMO id do Auth
  INSERT INTO public.usuarios (id, email, nome, papel, codigo_empresa)
  VALUES (v_user_id, v_email, v_nome_usuario, v_papel_usuario, v_codigo_empresa)
  ON CONFLICT (id) DO UPDATE
    SET email          = EXCLUDED.email,
        nome           = EXCLUDED.nome,
        papel          = EXCLUDED.papel,
        codigo_empresa = EXCLUDED.codigo_empresa;

  -- 4) Upsert em public.colaboradores usando o MESMO id do Auth
  INSERT INTO public.colaboradores (id, codigo_empresa, nome, cargo, ativo)
  VALUES (v_user_id, v_codigo_empresa, v_nome_usuario, v_papel_usuario, v_ativo_colab)
  ON CONFLICT (id) DO UPDATE
    SET codigo_empresa = EXCLUDED.codigo_empresa,
        nome           = EXCLUDED.nome,
        cargo          = EXCLUDED.cargo,
        ativo          = EXCLUDED.ativo;

  RAISE NOTICE 'Empresa (%) vinculada ao usuário (%)', v_codigo_empresa, v_email;
END$$;
```

## Observações importantes
- O app usa `codigo_empresa` para isolar dados (RLS). Certifique-se de que:
  - `public.empresas.codigo_empresa` exista e esteja correto.
  - O usuário tenha o mesmo `id` do Auth em `public.usuarios` e `public.colaboradores` (o script faz isso automaticamente).
- Se suas RLS dependem de funções como `get_my_company_code()`, garanta que as versões atualizadas (com fallback para `usuarios`) estejam aplicadas, conforme documentação em `estrutura_bd/`.

## Testes rápidos pós-execução
- Faça logout/login na aplicação com o e-mail configurado.
- Verifique se o header mostra a empresa correta e se as páginas privadas carregam normalmente.
- Caso algo bloqueie a leitura da empresa, revise as RLS de `public.empresas`.
