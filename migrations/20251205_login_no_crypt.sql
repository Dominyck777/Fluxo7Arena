-- ============================================================================
-- LOGIN SEM CRYPT - Solução alternativa para DEV
-- ============================================================================
-- Como pgcrypto não funciona no Supabase DEV, vamos usar texto plano
-- IMPORTANTE: Isso é menos seguro, mas funciona

-- 1. Criar extensão pgjwt
CREATE EXTENSION IF NOT EXISTS pgjwt;

-- 2. Adicionar colunas necessárias na tabela usuarios
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS nome varchar(255),
  ADD COLUMN IF NOT EXISTS email varchar(255),
  ADD COLUMN IF NOT EXISTS papel varchar(50) DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS criado_em timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS codigo_empresa varchar(10),
  ADD COLUMN IF NOT EXISTS senha_hash text,
  ADD COLUMN IF NOT EXISTS tentativas_invalidas integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS login_bloqueado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 3. Se houver coluna 'senha', copiar para senha_hash (sem hash)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='senha'
  ) THEN
    UPDATE public.usuarios
    SET senha_hash = senha
    WHERE senha_hash IS NULL AND senha IS NOT NULL;
  END IF;
END $$;

-- 4. Se não houver senha_hash, criar senhas padrão
UPDATE public.usuarios
SET senha_hash = '123456'
WHERE senha_hash IS NULL;

-- 5. Criar funções helper
CREATE OR REPLACE FUNCTION public.fx_claim_text(key text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.' || key, true), '')::text;
$$;

-- 6. Função de login SEM CRYPT (compara texto plano)
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

  -- Comparar senha em texto plano (SEM CRYPT)
  IF v_user.senha_hash = p_password THEN
    v_secret := current_setting('app.settings.jwt_secret', true);
    IF COALESCE(v_secret, '') = '' THEN
      RAISE EXCEPTION 'jwt secret not configured';
    END IF;

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
    UPDATE public.usuarios
       SET tentativas_invalidas = COALESCE(tentativas_invalidas,0) + 1,
           atualizado_em = v_now
     WHERE id = v_user.id;
    RAISE EXCEPTION 'invalid credentials';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_login_dev(text, text) TO anon, authenticated;

-- 7. Criar índice
CREATE INDEX IF NOT EXISTS usuarios_email_lower_idx ON public.usuarios (LOWER(email));
