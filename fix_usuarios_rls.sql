-- SQL para corrigir políticas RLS da tabela usuarios (necessário para login)
-- Execute este SQL no Supabase SQL Editor

-- 1. Verificar se RLS está habilitado na tabela usuarios
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'usuarios';

-- 2. Habilitar RLS na tabela usuarios (se não estiver habilitado)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas existentes (evitar conflitos)
DROP POLICY IF EXISTS "Usuarios podem acessar seus proprios dados" ON public.usuarios;
DROP POLICY IF EXISTS "Usuarios podem ler seus proprios dados" ON public.usuarios;
DROP POLICY IF EXISTS "Users can view own profile" ON public.usuarios;

-- 4. Criar política para SELECT - usuários podem ler seus próprios dados
CREATE POLICY "Usuarios podem ler seus proprios dados" ON public.usuarios
FOR SELECT 
USING (id = auth.uid());

-- 5. Criar política para UPDATE - usuários podem atualizar seus próprios dados
CREATE POLICY "Usuarios podem atualizar seus proprios dados" ON public.usuarios
FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

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
WHERE tablename = 'usuarios';

-- 7. Testar se o usuário atual consegue acessar seus dados
SELECT 
  'Teste de acesso usuarios' as teste,
  u.*
FROM public.usuarios u
WHERE u.id = auth.uid();

-- 8. Verificar se existe registro para o usuário atual
SELECT 
  'Verificacao usuario atual' as info,
  auth.uid() as current_user_id,
  EXISTS(SELECT 1 FROM public.usuarios WHERE id = auth.uid()) as usuario_existe;
