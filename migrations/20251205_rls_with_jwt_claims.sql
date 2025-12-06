-- ============================================================================
-- RLS WITH JWT CLAIMS - Works for both DEV and MAIN
-- ============================================================================
-- Este script usa JWT claims (codigo_empresa) do token custom
-- Funciona com custom auth (usuarios table)

-- 1. Criar funções helper para ler JWT claims (se não existirem)
CREATE OR REPLACE FUNCTION public.fx_claim_text(key text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.' || key, true), '')::text;
$$;

CREATE OR REPLACE FUNCTION public.app_user_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- 2. RE-ENABLE RLS em todas as tabelas
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;

-- 3. DROP todas as políticas antigas
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
  END LOOP;
END $$;

-- 4. CRIAR POLÍTICAS RLS baseadas em JWT claims
-- Todas as políticas usam: codigo_empresa = fx_claim_text('codigo_empresa')

-- COMANDAS
CREATE POLICY "comandas_select" ON public.comandas
  FOR SELECT TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comandas_insert" ON public.comandas
  FOR INSERT TO authenticated
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comandas_update" ON public.comandas
  FOR UPDATE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'))
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comandas_delete" ON public.comandas
  FOR DELETE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

-- COMANDA_ITENS
CREATE POLICY "comanda_itens_select" ON public.comanda_itens
  FOR SELECT TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_itens_insert" ON public.comanda_itens
  FOR INSERT TO authenticated
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_itens_update" ON public.comanda_itens
  FOR UPDATE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'))
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_itens_delete" ON public.comanda_itens
  FOR DELETE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

-- COMANDA_CLIENTES
CREATE POLICY "comanda_clientes_select" ON public.comanda_clientes
  FOR SELECT TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_clientes_insert" ON public.comanda_clientes
  FOR INSERT TO authenticated
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_clientes_update" ON public.comanda_clientes
  FOR UPDATE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'))
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_clientes_delete" ON public.comanda_clientes
  FOR DELETE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

-- COMANDA_HISTORICO
CREATE POLICY "comanda_historico_select" ON public.comanda_historico
  FOR SELECT TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_historico_insert" ON public.comanda_historico
  FOR INSERT TO authenticated
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_historico_update" ON public.comanda_historico
  FOR UPDATE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'))
  WITH CHECK (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

CREATE POLICY "comanda_historico_delete" ON public.comanda_historico
  FOR DELETE TO authenticated
  USING (codigo_empresa::text = public.fx_claim_text('codigo_empresa'));

-- 5. GRANT básico
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO authenticated';
  END LOOP;
END $$;

-- 6. GRANT em sequences
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.sequencename) || ' TO authenticated';
  END LOOP;
END $$;
