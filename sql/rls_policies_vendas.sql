-- =====================================================
-- POLÍTICAS RLS PARA SISTEMA DE VENDAS/COMANDAS
-- Fluxo7Arena - Multi-tenant por codigo_empresa
-- =====================================================
-- 
-- IMPORTANTE: Execute este script no SQL Editor do Supabase
-- depois de verificar que a função get_my_company_code() existe
--
-- =====================================================

-- Verificar se a função existe (deve retornar 1 linha)
-- SELECT proname FROM pg_proc WHERE proname = 'get_my_company_code';

-- =====================================================
-- 1. TABELA: comandas (ou vendas)
-- =====================================================

-- Habilitar RLS se ainda não estiver
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem (para recriar)
DROP POLICY IF EXISTS comandas_select_by_company ON public.comandas;
DROP POLICY IF EXISTS comandas_insert_by_company ON public.comandas;
DROP POLICY IF EXISTS comandas_update_by_company ON public.comandas;
DROP POLICY IF EXISTS comandas_delete_by_company ON public.comandas;

-- SELECT: Usuário vê apenas comandas da sua empresa
CREATE POLICY comandas_select_by_company
ON public.comandas
FOR SELECT
USING (codigo_empresa = public.get_my_company_code());

-- INSERT: Usuário pode criar comandas apenas para sua empresa
CREATE POLICY comandas_insert_by_company
ON public.comandas
FOR INSERT
WITH CHECK (codigo_empresa = public.get_my_company_code());

-- UPDATE: Usuário pode atualizar apenas comandas da sua empresa
CREATE POLICY comandas_update_by_company
ON public.comandas
FOR UPDATE
USING (codigo_empresa = public.get_my_company_code())
WITH CHECK (codigo_empresa = public.get_my_company_code());

-- DELETE: Usuário pode deletar apenas comandas da sua empresa
CREATE POLICY comandas_delete_by_company
ON public.comandas
FOR DELETE
USING (codigo_empresa = public.get_my_company_code());

-- =====================================================
-- 2. TABELA: comanda_itens (ou itens_venda)
-- =====================================================

ALTER TABLE public.comanda_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comanda_itens_select_by_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_insert_by_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_update_by_company ON public.comanda_itens;
DROP POLICY IF EXISTS comanda_itens_delete_by_company ON public.comanda_itens;

CREATE POLICY comanda_itens_select_by_company
ON public.comanda_itens FOR SELECT
USING (codigo_empresa = public.get_my_company_code());

CREATE POLICY comanda_itens_insert_by_company
ON public.comanda_itens FOR INSERT
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY comanda_itens_update_by_company
ON public.comanda_itens FOR UPDATE
USING (codigo_empresa = public.get_my_company_code())
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY comanda_itens_delete_by_company
ON public.comanda_itens FOR DELETE
USING (codigo_empresa = public.get_my_company_code());

-- =====================================================
-- 3. TABELA: pagamentos
-- =====================================================

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pagamentos_select_by_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_insert_by_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_update_by_company ON public.pagamentos;
DROP POLICY IF EXISTS pagamentos_delete_by_company ON public.pagamentos;

CREATE POLICY pagamentos_select_by_company
ON public.pagamentos FOR SELECT
USING (codigo_empresa = public.get_my_company_code());

CREATE POLICY pagamentos_insert_by_company
ON public.pagamentos FOR INSERT
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY pagamentos_update_by_company
ON public.pagamentos FOR UPDATE
USING (codigo_empresa = public.get_my_company_code())
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY pagamentos_delete_by_company
ON public.pagamentos FOR DELETE
USING (codigo_empresa = public.get_my_company_code());

-- =====================================================
-- 4. TABELA: mesas
-- =====================================================

ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mesas_select_by_company ON public.mesas;
DROP POLICY IF EXISTS mesas_insert_by_company ON public.mesas;
DROP POLICY IF EXISTS mesas_update_by_company ON public.mesas;
DROP POLICY IF EXISTS mesas_delete_by_company ON public.mesas;

CREATE POLICY mesas_select_by_company
ON public.mesas FOR SELECT
USING (codigo_empresa = public.get_my_company_code());

CREATE POLICY mesas_insert_by_company
ON public.mesas FOR INSERT
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY mesas_update_by_company
ON public.mesas FOR UPDATE
USING (codigo_empresa = public.get_my_company_code())
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY mesas_delete_by_company
ON public.mesas FOR DELETE
USING (codigo_empresa = public.get_my_company_code());

-- =====================================================
-- 5. TABELA: caixa_sessoes
-- =====================================================

ALTER TABLE public.caixa_sessoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS caixa_sessoes_select_by_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_insert_by_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_update_by_company ON public.caixa_sessoes;
DROP POLICY IF EXISTS caixa_sessoes_delete_by_company ON public.caixa_sessoes;

CREATE POLICY caixa_sessoes_select_by_company
ON public.caixa_sessoes FOR SELECT
USING (codigo_empresa = public.get_my_company_code());

CREATE POLICY caixa_sessoes_insert_by_company
ON public.caixa_sessoes FOR INSERT
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY caixa_sessoes_update_by_company
ON public.caixa_sessoes FOR UPDATE
USING (codigo_empresa = public.get_my_company_code())
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY caixa_sessoes_delete_by_company
ON public.caixa_sessoes FOR DELETE
USING (codigo_empresa = public.get_my_company_code());

-- =====================================================
-- 6. TABELA: caixa_movimentacoes
-- =====================================================

ALTER TABLE public.caixa_movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS caixa_movimentacoes_select_by_company ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_movimentacoes_insert_by_company ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_movimentacoes_update_by_company ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS caixa_movimentacoes_delete_by_company ON public.caixa_movimentacoes;

CREATE POLICY caixa_movimentacoes_select_by_company
ON public.caixa_movimentacoes FOR SELECT
USING (codigo_empresa = public.get_my_company_code());

CREATE POLICY caixa_movimentacoes_insert_by_company
ON public.caixa_movimentacoes FOR INSERT
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY caixa_movimentacoes_update_by_company
ON public.caixa_movimentacoes FOR UPDATE
USING (codigo_empresa = public.get_my_company_code())
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY caixa_movimentacoes_delete_by_company
ON public.caixa_movimentacoes FOR DELETE
USING (codigo_empresa = public.get_my_company_code());

-- =====================================================
-- 7. TABELA: comanda_clientes (vínculo cliente-comanda)
-- =====================================================

ALTER TABLE public.comanda_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comanda_clientes_select_by_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_insert_by_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_update_by_company ON public.comanda_clientes;
DROP POLICY IF EXISTS comanda_clientes_delete_by_company ON public.comanda_clientes;

CREATE POLICY comanda_clientes_select_by_company
ON public.comanda_clientes FOR SELECT
USING (codigo_empresa = public.get_my_company_code());

CREATE POLICY comanda_clientes_insert_by_company
ON public.comanda_clientes FOR INSERT
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY comanda_clientes_update_by_company
ON public.comanda_clientes FOR UPDATE
USING (codigo_empresa = public.get_my_company_code())
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY comanda_clientes_delete_by_company
ON public.comanda_clientes FOR DELETE
USING (codigo_empresa = public.get_my_company_code());

-- =====================================================
-- 8. TABELA: finalizadoras (métodos de pagamento)
-- =====================================================

ALTER TABLE public.finalizadoras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finalizadoras_select_by_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_insert_by_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_update_by_company ON public.finalizadoras;
DROP POLICY IF EXISTS finalizadoras_delete_by_company ON public.finalizadoras;

CREATE POLICY finalizadoras_select_by_company
ON public.finalizadoras FOR SELECT
USING (codigo_empresa = public.get_my_company_code());

CREATE POLICY finalizadoras_insert_by_company
ON public.finalizadoras FOR INSERT
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY finalizadoras_update_by_company
ON public.finalizadoras FOR UPDATE
USING (codigo_empresa = public.get_my_company_code())
WITH CHECK (codigo_empresa = public.get_my_company_code());

CREATE POLICY finalizadoras_delete_by_company
ON public.finalizadoras FOR DELETE
USING (codigo_empresa = public.get_my_company_code());

-- =====================================================
-- ÍNDICES PARA PERFORMANCE (se ainda não existirem)
-- =====================================================

-- Índice composto para comandas (codigo_empresa + fechado_em)
CREATE INDEX IF NOT EXISTS idx_comandas_empresa_fechado 
ON public.comandas(codigo_empresa, fechado_em);

-- Índice para mesas por empresa
CREATE INDEX IF NOT EXISTS idx_mesas_empresa 
ON public.mesas(codigo_empresa);

-- Índice para itens de comanda por empresa
CREATE INDEX IF NOT EXISTS idx_comanda_itens_empresa 
ON public.comanda_itens(codigo_empresa);

-- Índice para pagamentos por empresa
CREATE INDEX IF NOT EXISTS idx_pagamentos_empresa 
ON public.pagamentos(codigo_empresa);

-- Índice para caixa_sessoes por empresa e status
CREATE INDEX IF NOT EXISTS idx_caixa_sessoes_empresa_status 
ON public.caixa_sessoes(codigo_empresa, status);

-- =====================================================
-- VALIDAÇÃO FINAL
-- =====================================================

-- Verificar políticas criadas (deve retornar várias linhas)
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('comandas', 'comanda_itens', 'pagamentos', 'mesas', 'caixa_sessoes', 'comanda_clientes', 'finalizadoras')
ORDER BY tablename, policyname;

-- =====================================================
-- CONCLUÍDO
-- =====================================================
-- 
-- Após executar este script:
-- 1. Verifique se todas as políticas foram criadas
-- 2. Teste no frontend se as queries funcionam corretamente
-- 3. Monitore os logs para verificar se não há mais travamentos
-- 
-- =====================================================
