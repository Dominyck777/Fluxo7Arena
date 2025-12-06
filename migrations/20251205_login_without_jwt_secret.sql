-- ============================================================================
-- LOGIN SEM JWT SECRET - Usar secret hardcoded
-- ============================================================================

-- 1. Criar extensão pgjwt
CREATE EXTENSION IF NOT EXISTS pgjwt;

-- 2. Recriar função de login com secret hardcoded
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
  v_secret text := 'your-secret-key-change-in-production-fluxo7arena-dev-2024';
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

  IF v_user.senha_hash IS NULL THEN
    RAISE EXCEPTION 'invalid credentials';
  END IF;

  IF COALESCE(v_user.login_bloqueado, false) THEN
    RAISE EXCEPTION 'user blocked';
  END IF;

  -- Comparar senha em texto plano
  IF v_user.senha_hash = p_password THEN
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
