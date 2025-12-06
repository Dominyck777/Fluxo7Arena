-- ============================================================================
-- FIX RLS POLICIES FOR DEV BRANCH - FORCE RECREATION
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "comandas_select_own_company" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert_own_company" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update_own_company" ON public.comandas;
DROP POLICY IF EXISTS "comandas_delete_own_company" ON public.comandas;

DROP POLICY IF EXISTS "comanda_itens_select_own_company" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_insert_own_company" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_update_own_company" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_delete_own_company" ON public.comanda_itens;

DROP POLICY IF EXISTS "comanda_clientes_select_own_company" ON public.comanda_clientes;
DROP POLICY IF EXISTS "comanda_clientes_insert_own_company" ON public.comanda_clientes;
DROP POLICY IF EXISTS "comanda_clientes_update_own_company" ON public.comanda_clientes;
DROP POLICY IF EXISTS "comanda_clientes_delete_own_company" ON public.comanda_clientes;

-- Enable RLS
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_clientes ENABLE ROW LEVEL SECURITY;

-- COMANDAS POLICIES
CREATE POLICY "comandas_select_own_company" ON public.comandas
  FOR SELECT
  USING (codigo_empresa = get_my_company_code());

CREATE POLICY "comandas_insert_own_company" ON public.comandas
  FOR INSERT
  WITH CHECK (codigo_empresa = get_my_company_code());

CREATE POLICY "comandas_update_own_company" ON public.comandas
  FOR UPDATE
  USING (codigo_empresa = get_my_company_code())
  WITH CHECK (codigo_empresa = get_my_company_code());

CREATE POLICY "comandas_delete_own_company" ON public.comandas
  FOR DELETE
  USING (codigo_empresa = get_my_company_code());

-- COMANDA_ITENS POLICIES
CREATE POLICY "comanda_itens_select_own_company" ON public.comanda_itens
  FOR SELECT
  USING (codigo_empresa = get_my_company_code());

CREATE POLICY "comanda_itens_insert_own_company" ON public.comanda_itens
  FOR INSERT
  WITH CHECK (codigo_empresa = get_my_company_code());

CREATE POLICY "comanda_itens_update_own_company" ON public.comanda_itens
  FOR UPDATE
  USING (codigo_empresa = get_my_company_code())
  WITH CHECK (codigo_empresa = get_my_company_code());

CREATE POLICY "comanda_itens_delete_own_company" ON public.comanda_itens
  FOR DELETE
  USING (codigo_empresa = get_my_company_code());

-- COMANDA_CLIENTES POLICIES
CREATE POLICY "comanda_clientes_select_own_company" ON public.comanda_clientes
  FOR SELECT
  USING (codigo_empresa = get_my_company_code());

CREATE POLICY "comanda_clientes_insert_own_company" ON public.comanda_clientes
  FOR INSERT
  WITH CHECK (codigo_empresa = get_my_company_code());

CREATE POLICY "comanda_clientes_update_own_company" ON public.comanda_clientes
  FOR UPDATE
  USING (codigo_empresa = get_my_company_code())
  WITH CHECK (codigo_empresa = get_my_company_code());

CREATE POLICY "comanda_clientes_delete_own_company" ON public.comanda_clientes
  FOR DELETE
  USING (codigo_empresa = get_my_company_code());
