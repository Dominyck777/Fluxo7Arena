-- ============================================================================
-- RLS POLICIES FOR CUSTOM AUTH (usuarios table)
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

-- 2. DROP todas as políticas antigas
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
  END LOOP;
END $$;

-- 3. CRIAR FUNÇÃO PARA OBTER codigo_empresa DO USUÁRIO LOGADO
-- Esta função obtém o codigo_empresa do usuário armazenado em localStorage
-- Para isso, usamos um JWT custom que contém o user_id
CREATE OR REPLACE FUNCTION public.get_user_company_from_custom_auth() RETURNS text AS $$
DECLARE
  v_user_id text;
  v_company_code text;
BEGIN
  -- Tentar obter user_id do JWT custom (se disponível)
  -- Nota: Em custom auth, o JWT é armazenado em localStorage no frontend
  -- Aqui tentamos obter via auth.uid() como fallback
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    -- Buscar codigo_empresa do usuário
    SELECT u.codigo_empresa INTO v_company_code
    FROM public.usuarios u
    WHERE u.id = v_user_id
    LIMIT 1;
    
    IF v_company_code IS NOT NULL THEN
      RETURN v_company_code;
    END IF;
  END IF;
  
  -- Se não conseguir via auth.uid(), retornar NULL
  -- O frontend vai passar codigo_empresa via query parameter
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth';

-- 4. POLÍTICAS RLS - Permitir acesso a todas as tabelas
-- Como estamos usando custom auth, vamos permitir acesso baseado em:
-- - codigo_empresa na tabela (se existir)
-- - Sem restrição se não houver codigo_empresa

-- COMANDAS
CREATE POLICY "comandas_select" ON public.comandas
  FOR SELECT
  USING (true); -- Permitir leitura de todas as comandas por enquanto

CREATE POLICY "comandas_insert" ON public.comandas
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "comandas_update" ON public.comandas
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "comandas_delete" ON public.comandas
  FOR DELETE
  USING (true);

-- COMANDA_ITENS
CREATE POLICY "comanda_itens_select" ON public.comanda_itens
  FOR SELECT
  USING (true);

CREATE POLICY "comanda_itens_insert" ON public.comanda_itens
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "comanda_itens_update" ON public.comanda_itens
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "comanda_itens_delete" ON public.comanda_itens
  FOR DELETE
  USING (true);

-- COMANDA_CLIENTES
CREATE POLICY "comanda_clientes_select" ON public.comanda_clientes
  FOR SELECT
  USING (true);

CREATE POLICY "comanda_clientes_insert" ON public.comanda_clientes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "comanda_clientes_update" ON public.comanda_clientes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "comanda_clientes_delete" ON public.comanda_clientes
  FOR DELETE
  USING (true);

-- COMANDA_HISTORICO
CREATE POLICY "comanda_historico_select" ON public.comanda_historico
  FOR SELECT
  USING (true);

CREATE POLICY "comanda_historico_insert" ON public.comanda_historico
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "comanda_historico_update" ON public.comanda_historico
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "comanda_historico_delete" ON public.comanda_historico
  FOR DELETE
  USING (true);

-- 5. GRANT BÁSICO
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO authenticated';
  END LOOP;
END $$;
