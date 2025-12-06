-- ============================================================================
-- PROPER RLS POLICIES - SECURE SOLUTION
-- ============================================================================

-- 1. RE-ENABLE RLS em todas as tabelas
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;

-- 2. DROP todas as políticas antigas (se existirem)
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
  END LOOP;
END $$;

-- 3. CRIAR POLÍTICAS PARA TABELAS PRINCIPAIS
-- ============================================================================

-- COMANDAS
CREATE POLICY "comandas_select" ON public.comandas
  FOR SELECT
  USING (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comandas_insert" ON public.comandas
  FOR INSERT
  WITH CHECK (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comandas_update" ON public.comandas
  FOR UPDATE
  USING (codigo_empresa::text = public.get_my_company_code())
  WITH CHECK (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comandas_delete" ON public.comandas
  FOR DELETE
  USING (codigo_empresa::text = public.get_my_company_code());

-- COMANDA_ITENS
CREATE POLICY "comanda_itens_select" ON public.comanda_itens
  FOR SELECT
  USING (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comanda_itens_insert" ON public.comanda_itens
  FOR INSERT
  WITH CHECK (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comanda_itens_update" ON public.comanda_itens
  FOR UPDATE
  USING (codigo_empresa::text = public.get_my_company_code())
  WITH CHECK (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comanda_itens_delete" ON public.comanda_itens
  FOR DELETE
  USING (codigo_empresa::text = public.get_my_company_code());

-- COMANDA_CLIENTES
CREATE POLICY "comanda_clientes_select" ON public.comanda_clientes
  FOR SELECT
  USING (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comanda_clientes_insert" ON public.comanda_clientes
  FOR INSERT
  WITH CHECK (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comanda_clientes_update" ON public.comanda_clientes
  FOR UPDATE
  USING (codigo_empresa::text = public.get_my_company_code())
  WITH CHECK (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comanda_clientes_delete" ON public.comanda_clientes
  FOR DELETE
  USING (codigo_empresa::text = public.get_my_company_code());

-- COMANDA_HISTORICO
CREATE POLICY "comanda_historico_select" ON public.comanda_historico
  FOR SELECT
  USING (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comanda_historico_insert" ON public.comanda_historico
  FOR INSERT
  WITH CHECK (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comanda_historico_update" ON public.comanda_historico
  FOR UPDATE
  USING (codigo_empresa::text = public.get_my_company_code())
  WITH CHECK (codigo_empresa::text = public.get_my_company_code());

CREATE POLICY "comanda_historico_delete" ON public.comanda_historico
  FOR DELETE
  USING (codigo_empresa::text = public.get_my_company_code());

-- 4. GRANT BÁSICO (sem ALL PRIVILEGES)
-- Apenas SELECT, INSERT, UPDATE, DELETE - o mínimo necessário
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO authenticated';
  END LOOP;
END $$;
