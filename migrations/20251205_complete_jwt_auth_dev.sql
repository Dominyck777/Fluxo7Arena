-- ============================================================================
-- COMPLETE JWT AUTH FOR DEV - auth_login_dev + RLS Policies
-- ============================================================================

-- 1. Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgjwt;

-- 2. Funções helper para ler JWT claims
CREATE OR REPLACE FUNCTION public.fx_claim_text(key text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.' || key, true), '')::text;
$$;

CREATE OR REPLACE FUNCTION public.app_user_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- 3. Função de login custom (auth_login_dev)
DROP FUNCTION IF EXISTS public.auth_login_dev(text, text);
CREATE FUNCTION public.auth_login_dev(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_now timestamptz := now();
  v_exp_seconds integer := 60*60*24*45; -- 45 dias
  v_secret text;
  v_token text;
BEGIN
  -- Buscar usuário por email
  SELECT u.* INTO v_user
    FROM public.usuarios u
   WHERE LOWER(u.email) = LOWER(p_email)
   LIMIT 1;

  IF v_user IS NULL OR v_user.senha_hash IS NULL THEN
    RAISE EXCEPTION 'invalid credentials';
  END IF;

  IF COALESCE(v_user.login_bloqueado, false) THEN
    RAISE EXCEPTION 'user blocked';
  END IF;

  -- Verificar senha
  IF crypt(p_password, v_user.senha_hash) = v_user.senha_hash THEN
    -- Obter JWT secret
    v_secret := current_setting('app.settings.jwt_secret', true);
    IF COALESCE(v_secret, '') = '' THEN
      RAISE EXCEPTION 'jwt secret not configured';
    END IF;

    -- Criar JWT com claims
    v_token := sign(
      json_build_object(
        'aud','authenticated',
        'iss','supabase',
        'sub', v_user.id::text,
        'role','authenticated',
        'email', v_user.email,
        'papel', COALESCE(v_user.papel,'user'),
        'codigo_empresa', v_user.codigo_empresa,
        'iat', extract(epoch from v_now)::int,
        'exp', extract(epoch from (v_now + make_interval(secs => v_exp_seconds)))::int
      ),
      v_secret
    );

    -- Atualizar último login
    UPDATE public.usuarios
       SET last_login_at = v_now,
           tentativas_invalidas = 0,
           atualizado_em = v_now
     WHERE id = v_user.id;

    RETURN jsonb_build_object(
      'access_token', v_token,
      'user', jsonb_build_object(
        'id', v_user.id,
        'nome', v_user.nome,
        'email', v_user.email,
        'papel', v_user.papel,
        'codigo_empresa', v_user.codigo_empresa
      )
    );
  ELSE
    -- Incrementar tentativas inválidas
    UPDATE public.usuarios
       SET tentativas_invalidas = COALESCE(tentativas_invalidas,0) + 1,
           atualizado_em = v_now
     WHERE id = v_user.id;
    RAISE EXCEPTION 'invalid credentials';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_login_dev(text, text) TO anon, authenticated;

-- 4. RE-ENABLE RLS em todas as tabelas
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;

-- 5. DROP todas as políticas antigas
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
  END LOOP;
END $$;

-- 6. CRIAR POLÍTICAS RLS baseadas em JWT claims

-- COMANDAS
CREATE POLICY "comandas_select" ON public.comandas
  FOR SELECT TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comandas_insert" ON public.comandas
  FOR INSERT TO authenticated
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comandas_update" ON public.comandas
  FOR UPDATE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'))
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comandas_delete" ON public.comandas
  FOR DELETE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

-- COMANDA_ITENS
CREATE POLICY "comanda_itens_select" ON public.comanda_itens
  FOR SELECT TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_itens_insert" ON public.comanda_itens
  FOR INSERT TO authenticated
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_itens_update" ON public.comanda_itens
  FOR UPDATE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'))
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_itens_delete" ON public.comanda_itens
  FOR DELETE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

-- COMANDA_CLIENTES
CREATE POLICY "comanda_clientes_select" ON public.comanda_clientes
  FOR SELECT TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_clientes_insert" ON public.comanda_clientes
  FOR INSERT TO authenticated
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_clientes_update" ON public.comanda_clientes
  FOR UPDATE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'))
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_clientes_delete" ON public.comanda_clientes
  FOR DELETE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

-- COMANDA_HISTORICO
CREATE POLICY "comanda_historico_select" ON public.comanda_historico
  FOR SELECT TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_historico_insert" ON public.comanda_historico
  FOR INSERT TO authenticated
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_historico_update" ON public.comanda_historico
  FOR UPDATE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'))
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_historico_delete" ON public.comanda_historico
  FOR DELETE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

-- 7. GRANT básico
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO authenticated';
  END LOOP;
END $$;

-- 8. GRANT em sequences
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.sequencename) || ' TO authenticated';
  END LOOP;
END $$;
