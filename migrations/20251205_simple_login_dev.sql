-- ============================================================================
-- SIMPLE LOGIN DEV - Função de login simples sem crypt
-- ============================================================================

-- 1. Criar extensão pgjwt
CREATE EXTENSION IF NOT EXISTS pgjwt;

-- 2. Função simples de login (compara senha em texto plano)
CREATE OR REPLACE FUNCTION public.auth_login_dev(p_email text, p_password text)
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

  -- Comparar senha em texto plano (sem hash)
  -- Ajuste o nome da coluna se for diferente
  IF v_user.senha IS NOT NULL AND v_user.senha = p_password THEN
    
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
        'iat', extract(epoch from v_now)::int,
        'exp', extract(epoch from (v_now + make_interval(secs => v_exp_seconds)))::int
      ),
      v_secret
    );

    RETURN jsonb_build_object(
      'access_token', v_token,
      'user', jsonb_build_object(
        'id', v_user.id,
        'nome', v_user.nome,
        'email', v_user.email
      )
    );
  ELSE
    RAISE EXCEPTION 'invalid credentials';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_login_dev(text, text) TO anon, authenticated;
