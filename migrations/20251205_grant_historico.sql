-- ============================================================================
-- GRANT ACCESS TO comanda_historico
-- ============================================================================

-- Desabilitar RLS
ALTER TABLE IF EXISTS public.comanda_historico DISABLE ROW LEVEL SECURITY;

-- Grant total para todos os roles
GRANT ALL PRIVILEGES ON public.comanda_historico TO PUBLIC;
GRANT ALL PRIVILEGES ON public.comanda_historico TO anon;
GRANT ALL PRIVILEGES ON public.comanda_historico TO authenticated;
GRANT ALL PRIVILEGES ON public.comanda_historico TO service_role;
