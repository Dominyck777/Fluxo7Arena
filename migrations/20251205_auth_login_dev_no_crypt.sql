-- ============================================================================
-- auth_login_dev SEM CRYPT - Alternativa simples
-- ============================================================================
-- Esta versão não usa crypt, apenas compara senhas em texto plano
-- NOTA: Isso é menos seguro, mas funciona no Supabase DEV

-- 1. Criar extensão pgjwt (necessária para sign)
CREATE EXTENSION IF NOT EXISTS pgjwt;

-- 2. Funções helper
CREATE OR REPLACE FUNCTION public.fx_claim_text(key text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.' || key, true), '')::text;
$$;

-- 3. Função de login SEM CRYPT
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

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'invalid credentials';
  END IF;

  IF COALESCE(v_user.login_bloqueado, false) THEN
    RAISE EXCEPTION 'user blocked';
  END IF;

  -- Comparar senha em texto plano (sem hash)
  -- IMPORTANTE: Ajuste o nome da coluna de senha se for diferente
  IF (v_user.senha IS NOT NULL AND v_user.senha = p_password) OR
     (v_user.senha_hash IS NOT NULL AND v_user.senha_hash = p_password) THEN
    
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
