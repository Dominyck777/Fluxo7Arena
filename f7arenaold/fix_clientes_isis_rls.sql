-- SQL para corrigir políticas RLS da tabela clientes para permitir acesso da Ísis
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar se RLS está habilitado na tabela clientes
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'clientes';

-- 2. Habilitar RLS na tabela clientes (se não estiver habilitado)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas conflitantes (evitar erros)
DROP POLICY IF EXISTS "Permitir acesso anonimo para busca de clientes" ON public.clientes;
DROP POLICY IF EXISTS "Isis pode buscar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Acesso publico para busca clientes" ON public.clientes;

-- 4. Criar política para SELECT - permite busca anônima de clientes (necessário para Ísis)
CREATE POLICY "Isis pode buscar clientes" ON public.clientes
FOR SELECT 
TO anon, authenticated
USING (true);

-- 5. Criar política para INSERT - permite criar clientes (necessário para cadastro via Ísis)
CREATE POLICY "Isis pode criar clientes" ON public.clientes
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

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
WHERE tablename = 'clientes';

-- 7. Testar busca de clientes (deve funcionar mesmo sem auth)
SELECT 
  'Teste busca clientes' as teste,
  COUNT(*) as total_clientes
FROM public.clientes 
WHERE codigo_empresa = '1005'
  AND status = 'active';

-- 8. Verificar se existe cliente consumidor final
SELECT 
  'Cliente consumidor final' as info,
  id,
  nome,
  is_consumidor_final
FROM public.clientes 
WHERE codigo_empresa = '1005' 
  AND is_consumidor_final = true;
