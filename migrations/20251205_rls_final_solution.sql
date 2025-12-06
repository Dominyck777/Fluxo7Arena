-- ============================================================================
-- FINAL RLS SOLUTION - CUSTOM AUTH (usuarios table)
-- ============================================================================

-- 1. RE-ENABLE RLS
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;

-- 2. DROP todas as políticas antigas
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
  END LOOP;
END $$;

-- 3. CRIAR POLÍTICAS PERMISSIVAS (PERMISSIVE = permite acesso)
-- Para custom auth, usamos políticas permissivas que permitem acesso irrestrito

-- COMANDAS
CREATE POLICY "comandas_all" ON public.comandas
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- COMANDA_ITENS
CREATE POLICY "comanda_itens_all" ON public.comanda_itens
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- COMANDA_CLIENTES
CREATE POLICY "comanda_clientes_all" ON public.comanda_clientes
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- COMANDA_HISTORICO
CREATE POLICY "comanda_historico_all" ON public.comanda_historico
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- MESAS (se existir)
CREATE POLICY "mesas_all" ON public.mesas
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- PRODUTOS (se existir)
CREATE POLICY "produtos_all" ON public.produtos
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- CLIENTES (se existir)
CREATE POLICY "clientes_all" ON public.clientes
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- USUARIOS (se existir)
CREATE POLICY "usuarios_all" ON public.usuarios
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- EMPRESAS (se existir)
CREATE POLICY "empresas_all" ON public.empresas
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- FINALIZADORAS (se existir)
CREATE POLICY "finalizadoras_all" ON public.finalizadoras
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- CAIXA_SESSOES (se existir)
CREATE POLICY "caixa_sessoes_all" ON public.caixa_sessoes
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- PAGAMENTOS (se existir)
CREATE POLICY "pagamentos_all" ON public.pagamentos
  AS PERMISSIVE
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. GRANT BÁSICO
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO authenticated';
  END LOOP;
END $$;

-- 5. GRANT em sequences
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.sequencename) || ' TO anon';
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.sequencename) || ' TO authenticated';
  END LOOP;
END $$;
