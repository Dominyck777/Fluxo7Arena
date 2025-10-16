-- =====================================================
-- LIMPEZA DE POLÍTICAS RLS DUPLICADAS
-- Fluxo7Arena - Remove todas as políticas antes de recriar
-- =====================================================
-- 
-- EXECUTE ESTE SCRIPT PRIMEIRO para limpar políticas duplicadas
-- 
-- =====================================================

-- =====================================================
-- COMANDAS - Remover todas as políticas
-- =====================================================
DROP POLICY IF EXISTS "Usuários podem atualizar comandas da sua empresa" ON public.comandas;
DROP POLICY IF EXISTS "Usuários podem criar comandas na sua empresa" ON public.comandas;
DROP POLICY IF EXISTS "Usuários podem deletar comandas da sua empresa" ON public.comandas;
DROP POLICY IF EXISTS "Usuários podem ver comandas da sua empresa" ON public.comandas;
DROP POLICY IF EXISTS comandas_delete_by_company ON public.comandas;
DROP POLICY IF EXISTS comandas_delete_company ON public.comandas;
DROP POLICY IF EXISTS comandas_insert_by_company ON public.comandas;
DROP POLICY IF EXISTS comandas_insert_company ON public.comandas;
DROP POLICY IF EXISTS comandas_rls_all ON public.comandas;
DROP POLICY IF EXISTS comandas_select_by_company ON public.comandas;
DROP POLICY IF EXISTS comandas_select_company ON public.comandas;
DROP POLICY IF EXISTS comandas_update_by_company ON public.comandas;
DROP POLICY IF EXISTS comandas_update_company ON public.comandas;

-- =====================================================
-- COMANDA_ITENS - Remover todas as políticas
-- =====================================================
DROP POLICY IF EXISTS "Usuários podem atualizar itens de comandas da sua empresa" ON public.comanda_itens;
DROP POLICY IF EXISTS "Usuários podem criar itens em comandas da sua empresa" ON public.comanda_itens;
DROP POLICY IF EXISTS "Usuários podem deletar itens de comandas da sua empresa" ON public.comanda_itens;
DROP POLICY IF EXISTS "Usuários podem ver itens de comandas da sua empresa" ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_delete_by_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_delete_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_insert_by_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_insert_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_rls_all ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_select_by_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_select_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_update_by_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_update_company ON public.comanda_itens;

-- =====================================================
-- PAGAMENTOS - Remover todas as políticas
-- =====================================================
DROP POLICY IF EXISTS "Usuários podem atualizar pagamentos da sua empresa" ON public.pagamentos;
DROP POLICY IF EXISTS "Usuários podem criar pagamentos na sua empresa" ON public.pagamentos;
DROP POLICY IF EXISTS "Usuários podem deletar pagamentos da sua empresa" ON public.pagamentos;
DROP POLICY IF EXISTS "Usuários podem ver pagamentos da sua empresa" ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_delete_by_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_delete_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_delete_policy ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_insert_by_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_insert_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_insert_policy ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_rls_all ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_select_by_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_select_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_select_policy ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_update_by_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_update_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_update_policy ON public.pagamentos;

-- =====================================================
-- MESAS - Remover todas as políticas
-- =====================================================
DROP POLICY IF EXISTS "Allow public insert mesas" ON public.mesas;
DROP POLICY IF EXISTS "Usuários podem atualizar mesas da sua empresa" ON public.mesas;
DROP POLICY IF EXISTS "Usuários podem criar mesas na sua empresa" ON public.mesas;
DROP POLICY IF EXISTS "Usuários podem deletar mesas da sua empresa" ON public.mesas;
DROP POLICY IF EXISTS "Usuários podem ver mesas da sua empresa" ON public.mesas;
DROP POLICY IF EXISTS mesas_delete_by_company ON public.mesas;
DROP POLICY IF EXISTS mesas_delete_company ON public.mesas;
DROP POLICY IF EXISTS mesas_insert_by_company ON public.mesas;
DROP POLICY IF EXISTS mesas_insert_company ON public.mesas;
DROP POLICY IF EXISTS mesas_rls_all ON public.mesas;
DROP POLICY IF EXISTS mesas_select_by_company ON public.mesas;
DROP POLICY IF EXISTS mesas_select_company ON public.mesas;
DROP POLICY IF EXISTS mesas_update_by_company ON public.mesas;
DROP POLICY IF EXISTS mesas_update_company ON public.mesas;

-- =====================================================
-- CAIXA_SESSOES - Remover todas as políticas
-- =====================================================
DROP POLICY IF EXISTS "Usuários podem atualizar sessões de caixa da sua empresa" ON public.caixa_sessoes;
DROP POLICY IF EXISTS "Usuários podem criar sessões de caixa na sua empresa" ON public.caixa_sessoes;
DROP POLICY IF EXISTS "Usuários podem deletar sessões de caixa da sua empresa" ON public.caixa_sessoes;
DROP POLICY IF EXISTS "Usuários podem ver sessões de caixa da sua empresa" ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_delete_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_insert_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_select_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_delete_by_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_delete_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_insert_by_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_insert_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_rls_all ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_select_by_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_select_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_update_by_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_update_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_update_company ON public.caixa_sessoes;

-- =====================================================
-- CAIXA_MOVIMENTACOES - Remover todas as políticas
-- =====================================================
DROP POLICY IF EXISTS caixa_movimentacoes_delete_by_company ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_movimentacoes_insert_by_company ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_movimentacoes_select_by_company ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_movimentacoes_update_by_company ON public.caixa_movimentacoes;

-- =====================================================
-- COMANDA_CLIENTES - Remover todas as políticas
-- =====================================================
DROP POLICY IF EXISTS "Usuários podem atualizar vínculos de clientes da sua empresa" ON public.comanda_clientes;
DROP POLICY IF EXISTS "Usuários podem criar vínculos de clientes na sua empresa" ON public.comanda_clientes;
DROP POLICY IF EXISTS "Usuários podem deletar vínculos de clientes da sua empresa" ON public.comanda_clientes;
DROP POLICY IF EXISTS "Usuários podem ver vínculos de clientes da sua empresa" ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_delete ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_delete_by_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_delete_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_insert ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_insert_by_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_insert_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_select ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_select_by_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_select_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_update ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_update_by_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_update_company ON public.comanda_clientes;

-- =====================================================
-- FINALIZADORAS - Remover todas as políticas
-- =====================================================
DROP POLICY IF EXISTS "Allow public insert finalizadoras" ON public.finalizadoras;
DROP POLICY IF EXISTS "Usuários podem atualizar finalizadoras da sua empresa" ON public.finalizadoras;
DROP POLICY IF EXISTS "Usuários podem criar finalizadoras na sua empresa" ON public.finalizadoras;
DROP POLICY IF EXISTS "Usuários podem deletar finalizadoras da sua empresa" ON public.finalizadoras;
DROP POLICY IF EXISTS "Usuários podem ver finalizadoras da sua empresa" ON public.finalizadoras;
DROP POLICY IF EXISTS del_finalizadoras ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_delete_by_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_delete_by_tenant ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_delete_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_insert_by_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_insert_by_tenant ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_insert_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_select_by_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_select_by_tenant ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_select_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_update_by_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_update_by_tenant ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_update_company ON public.finalizadoras;
DROP POLICY IF EXISTS ins_finalizadoras ON public.finalizadoras;
DROP POLICY IF EXISTS sel_finalizadoras ON public.finalizadoras;
DROP POLICY IF EXISTS upd_finalizadoras ON public.finalizadoras;

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- Deve retornar 0 linhas (todas as políticas removidas)
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('comandas', 'comanda_itens', 'pagamentos', 'mesas', 'caixa_sessoes', 'comanda_clientes', 'finalizadoras', 'caixa_movimentacoes')
ORDER BY tablename, policyname;

-- =====================================================
-- CONCLUÍDO
-- =====================================================
-- Agora execute o script rls_policies_vendas.sql
-- para criar as políticas limpas e organizadas
-- =====================================================
