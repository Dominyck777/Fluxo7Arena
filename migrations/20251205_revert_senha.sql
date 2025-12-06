-- ============================================================================
-- REVERT SENHA - Remover colunas de hash e voltar ao original
-- ============================================================================

-- 1. Remover view que depende das colunas
DROP VIEW IF EXISTS public.usuarios_safe;

-- 2. Remover colunas adicionadas
ALTER TABLE public.usuarios
  DROP COLUMN IF EXISTS senha_hash,
  DROP COLUMN IF EXISTS login_bloqueado,
  DROP COLUMN IF EXISTS tentativas_invalidas,
  DROP COLUMN IF EXISTS last_login_at,
  DROP COLUMN IF EXISTS atualizado_em,
  DROP COLUMN IF EXISTS papel;

-- 3. Remover funções criadas
DROP FUNCTION IF EXISTS public.auth_login_dev(text, text);
DROP FUNCTION IF EXISTS public.fx_claim_text(text);
DROP FUNCTION IF EXISTS public.app_user_id();
