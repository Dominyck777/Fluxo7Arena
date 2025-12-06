-- ============================================================================
-- GRANT ANON ACCESS - TEMPORARY FIX
-- Permite que a anon key acesse as tabelas (para debug)
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comandas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comanda_itens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comanda_clientes TO anon;
