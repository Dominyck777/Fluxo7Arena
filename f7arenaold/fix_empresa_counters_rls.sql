-- SQL para corrigir políticas RLS da tabela empresa_counters
-- Execute este SQL no Supabase SQL Editor

-- 1. Habilitar RLS na tabela empresa_counters (se não estiver habilitado)
ALTER TABLE public.empresa_counters ENABLE ROW LEVEL SECURITY;

-- 2. Política para SELECT - permite ler counters da própria empresa
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

-- 3. Política para UPDATE - permite atualizar counters da própria empresa
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

-- 4. Política para INSERT - permite criar counters para a própria empresa
CREATE POLICY "Usuarios podem criar counters da propria empresa" ON public.empresa_counters
FOR INSERT 
WITH CHECK (
  empresa_id IN (
    SELECT e.id 
    FROM public.empresas e 
    INNER JOIN public.usuarios u ON u.codigo_empresa = e.codigo_empresa 
    WHERE u.id = auth.uid()
  )
);

-- 5. Verificar se existe registro para a empresa (criar se não existir)
-- IMPORTANTE: Execute este INSERT apenas se não existir registro para sua empresa
-- Substitua 'SEU_EMPRESA_ID_AQUI' pelo ID real da sua empresa

INSERT INTO public.empresa_counters (empresa_id, next_cliente_codigo, next_agendamento_codigo)
SELECT 
  e.id,
  1,
  1
FROM public.empresas e
WHERE e.codigo_empresa = '1005' -- Substitua pelo código da sua empresa
  AND NOT EXISTS (
    SELECT 1 FROM public.empresa_counters ec WHERE ec.empresa_id = e.id
  );

-- 6. Verificar as políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'empresa_counters';
