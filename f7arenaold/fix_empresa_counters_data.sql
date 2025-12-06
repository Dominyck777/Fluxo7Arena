-- SQL para criar registro na empresa_counters e corrigir códigos duplicados
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar qual é o maior código de cliente existente para a empresa 1005
SELECT 
  'Maior codigo existente' as info,
  MAX(codigo) as maior_codigo,
  COUNT(*) as total_clientes
FROM public.clientes 
WHERE codigo_empresa = '1005';

-- 2. Buscar informações da empresa 1005
SELECT 
  'Dados da empresa' as info,
  id as empresa_id,
  codigo_empresa,
  nome_fantasia
FROM public.empresas 
WHERE codigo_empresa = '1005';

-- 3. Verificar se já existe registro na empresa_counters
SELECT 
  'Registro atual empresa_counters' as info,
  ec.*
FROM public.empresa_counters ec
INNER JOIN public.empresas e ON e.id = ec.empresa_id
WHERE e.codigo_empresa = '1005';

-- 4. Criar/atualizar registro na empresa_counters com próximo código correto
-- Primeiro, deletar registro existente (se houver)
DELETE FROM public.empresa_counters 
WHERE empresa_id IN (
  SELECT id FROM public.empresas WHERE codigo_empresa = '1005'
);

-- Inserir registro com próximo código correto
INSERT INTO public.empresa_counters (empresa_id, next_cliente_codigo, next_agendamento_codigo)
SELECT 
  e.id,
  COALESCE(MAX(c.codigo), 0) + 1, -- Próximo código baseado no maior existente
  1 -- Código de agendamento pode começar em 1
FROM public.empresas e
LEFT JOIN public.clientes c ON c.codigo_empresa = e.codigo_empresa
WHERE e.codigo_empresa = '1005'
GROUP BY e.id;

-- 5. Verificar se o registro foi criado corretamente
SELECT 
  'Registro criado' as info,
  ec.next_cliente_codigo,
  ec.next_agendamento_codigo,
  e.codigo_empresa,
  e.nome_fantasia
FROM public.empresa_counters ec
INNER JOIN public.empresas e ON e.id = ec.empresa_id
WHERE e.codigo_empresa = '1005';

-- 6. Habilitar RLS e criar políticas para empresa_counters (se necessário)
ALTER TABLE public.empresa_counters ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes
DROP POLICY IF EXISTS "Acesso publico empresa_counters" ON public.empresa_counters;

-- Criar política que permite acesso público (necessário para Ísis)
CREATE POLICY "Acesso publico empresa_counters" ON public.empresa_counters
FOR ALL 
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 7. Verificar políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'empresa_counters';

-- 8. Testar acesso à empresa_counters
SELECT 
  'Teste acesso empresa_counters' as teste,
  ec.next_cliente_codigo,
  e.codigo_empresa
FROM public.empresa_counters ec
INNER JOIN public.empresas e ON e.id = ec.empresa_id
WHERE e.codigo_empresa = '1005';
