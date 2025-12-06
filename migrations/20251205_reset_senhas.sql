-- ============================================================================
-- RESET SENHAS - Resetar todas as senhas para 123456 (texto plano)
-- ============================================================================

UPDATE public.usuarios
SET senha_hash = '123456'
WHERE 1=1;

-- Verificar
SELECT id, email, senha_hash FROM public.usuarios LIMIT 10;
