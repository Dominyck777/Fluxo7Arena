-- ============================================================================
-- FIX LOGIN - Preparar tabela usuarios para auth_login_dev
-- ============================================================================

-- 1. Adicionar coluna senha_hash se não existir
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS senha_hash text,
  ADD COLUMN IF NOT EXISTS login_bloqueado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tentativas_invalidas integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS papel varchar(50) DEFAULT 'user';

-- 2. Se houver coluna 'senha' (sem hash), fazer hash e copiar para senha_hash
-- IMPORTANTE: Ajuste 'senha' para o nome correto da coluna se for diferente
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='senha'
  ) THEN
    UPDATE public.usuarios
    SET senha_hash = crypt(senha, gen_salt('bf'))
    WHERE senha_hash IS NULL AND senha IS NOT NULL;
  END IF;
END $$;

-- 3. Se não houver coluna 'senha', criar senhas padrão (usuário precisa resetar depois)
UPDATE public.usuarios
SET senha_hash = crypt('123456', gen_salt('bf'))
WHERE senha_hash IS NULL;

-- 4. Criar índice para performance
CREATE INDEX IF NOT EXISTS usuarios_email_lower_idx ON public.usuarios (LOWER(email));
