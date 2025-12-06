-- ============================================================================
-- FINAL SOLUTION FOR DEV - DISABLE RLS
-- ============================================================================
-- No DEV, você usa custom auth (tabela usuarios), não Supabase Auth
-- Por isso RLS do Supabase não funciona
-- Solução: Desabilitar RLS e usar grants simples

-- 1. Desabilitar RLS em TODAS as tabelas
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;

-- 2. Grant SELECT, INSERT, UPDATE, DELETE para anon e authenticated
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO authenticated';
  END LOOP;
END $$;

-- 3. Grant em sequences
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.sequencename) || ' TO anon';
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.sequencename) || ' TO authenticated';
  END LOOP;
END $$;
