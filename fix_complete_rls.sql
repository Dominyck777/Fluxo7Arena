-- SQL completo para corrigir RLS e dados faltantes
-- Execute este SQL no Supabase SQL Editor

-- 1. Criar registro na empresa_counters para a empresa (se não existir)
INSERT INTO public.empresa_counters (empresa_id, next_cliente_codigo, next_agendamento_codigo)
SELECT 
  e.id,
  1,
  1
FROM public.empresas e
WHERE e.codigo_empresa = '1005' -- Código da sua empresa
  AND NOT EXISTS (
    SELECT 1 FROM public.empresa_counters ec WHERE ec.empresa_id = e.id
  );

-- 2. Verificar se o registro foi criado
SELECT 
  ec.*,
  e.codigo_empresa,
  e.nome_fantasia
FROM public.empresa_counters ec
INNER JOIN public.empresas e ON e.id = ec.empresa_id
WHERE e.codigo_empresa = '1005';

-- 3. Habilitar RLS na tabela empresa_counters (se não estiver habilitado)
ALTER TABLE public.empresa_counters ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas existentes (se houver conflito)
DROP POLICY IF EXISTS "Usuarios podem ler counters da propria empresa" ON public.empresa_counters;
DROP POLICY IF EXISTS "Usuarios podem atualizar counters da propria empresa" ON public.empresa_counters;
DROP POLICY IF EXISTS "Usuarios podem criar counters da propria empresa" ON public.empresa_counters;

-- 5. Criar políticas para empresa_counters
CREATE POLICY "Usuarios podem ler counters da propria empresa" ON public.empresa_counters
FOR SELECT 
USING (
  empresa_id IN (
    SELECT e.id 
    FROM public.empresas e 
    INNER JOIN public.usuarios u ON u.codigo_empresa = e.codigo_empresa 
    WHERE u.id = auth.uid()
  )
);

CREATE POLICY "Usuarios podem atualizar counters da propria empresa" ON public.empresa_counters
FOR UPDATE 
USING (
  empresa_id IN (
    SELECT e.id 
    FROM public.empresas e 
    INNER JOIN public.usuarios u ON u.codigo_empresa = e.codigo_empresa 
    WHERE u.id = auth.uid()
  )
)
WITH CHECK (
  empresa_id IN (
    SELECT e.id 
    FROM public.empresas e 
    INNER JOIN public.usuarios u ON u.codigo_empresa = e.codigo_empresa 
    WHERE u.id = auth.uid()
  )
);

-- 6. Verificar/corrigir políticas da tabela clientes
-- Remover políticas conflitantes
DROP POLICY IF EXISTS "Usuarios podem inserir clientes da propria empresa" ON public.clientes;

-- Criar política para INSERT na tabela clientes
CREATE POLICY "Usuarios podem inserir clientes da propria empresa" ON public.clientes
FOR INSERT 
WITH CHECK (
  codigo_empresa IN (
    SELECT u.codigo_empresa 
    FROM public.usuarios u 
    WHERE u.id = auth.uid()
  )
);

-- 7. Verificar se existe política de SELECT para clientes
CREATE POLICY IF NOT EXISTS "Usuarios podem ler clientes da propria empresa" ON public.clientes
FOR SELECT 
USING (
  codigo_empresa IN (
    SELECT u.codigo_empresa 
    FROM public.usuarios u 
    WHERE u.id = auth.uid()
  )
);

-- 8. Verificar todas as políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('empresa_counters', 'clientes')
ORDER BY tablename, policyname;

-- 9. Testar se o usuário atual tem acesso
SELECT 
  'Teste de acesso' as teste,
  u.codigo_empresa,
  e.id as empresa_id,
  e.nome_fantasia
FROM public.usuarios u
INNER JOIN public.empresas e ON e.codigo_empresa = u.codigo_empresa
WHERE u.id = auth.uid();
