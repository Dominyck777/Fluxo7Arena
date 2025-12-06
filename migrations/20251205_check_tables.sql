-- Verificar se as tabelas existem
SELECT schemaname, tablename FROM pg_tables WHERE tablename IN ('comandas', 'comanda_itens', 'comanda_clientes');

-- Verificar grants
SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name IN ('comandas', 'comanda_itens', 'comanda_clientes');

-- Verificar RLS status
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename IN ('comandas', 'comanda_itens', 'comanda_clientes');
