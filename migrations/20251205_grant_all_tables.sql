-- ============================================================================
-- GRANT ACCESS TO ALL PUBLIC TABLES - DISABLE RLS
-- ============================================================================

-- Desabilitar RLS em todas as tabelas
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;

-- Grant ALL para anon em todas as tabelas
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.tablename) || ' TO anon';
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.tablename) || ' TO authenticated';
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.tablename) || ' TO service_role';
  END LOOP;
END $$;

-- Grant ALL para sequences
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.sequencename) || ' TO anon';
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.sequencename) || ' TO authenticated';
    EXECUTE 'GRANT ALL PRIVILEGES ON public.' || quote_ident(r.sequencename) || ' TO service_role';
  END LOOP;
END $$;
