-- ============================================================================
-- DIAGNÓSTICO RLS - BRANCH DEV
-- Execute este script para descobrir por que o RLS não está funcionando
-- ============================================================================

-- 1. Verificar se as políticas foram criadas
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('comandas', 'comanda_itens', 'comanda_clientes')
ORDER BY tablename, policyname;

-- 2. Verificar se RLS está habilitado nas tabelas
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('comandas', 'comanda_itens', 'comanda_clientes')
ORDER BY tablename;

-- 3. Verificar se a função get_my_company_code() existe
SELECT routine_schema, routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'get_my_company_code'
ORDER BY routine_schema;

-- 4. Testar a função get_my_company_code() (como usuário autenticado)
-- Descomente a linha abaixo para testar
-- SELECT public.get_my_company_code();

-- 5. Verificar usuário autenticado atual
SELECT auth.uid();

-- 6. Verificar se o usuário existe em colaboradores
SELECT id, codigo_empresa FROM public.colaboradores WHERE id = auth.uid();

-- 7. Verificar se o usuário existe em usuarios
SELECT id, codigo_empresa FROM public.usuarios WHERE id = auth.uid();

-- 8. Listar TODAS as políticas da tabela comandas (para debug)
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'comandas';

-- 9. Listar TODAS as políticas da tabela comanda_itens (para debug)
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'comanda_itens';

-- 10. Listar TODAS as políticas da tabela comanda_clientes (para debug)
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'comanda_clientes';
