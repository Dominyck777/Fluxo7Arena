-- =====================================================
-- CORREÇÃO DE COMANDAS INCONSISTENTES
-- Fluxo7Arena - Corrige comandas com fechado_em=null mas status=closed
-- =====================================================

-- =====================================================
-- PASSO 1: INVESTIGAR comandas inconsistentes
-- =====================================================

-- Ver comandas com fechado_em=null mas status != 'open' e != 'awaiting-payment'
SELECT 
    id,
    codigo_empresa,
    mesa_id,
    status,
    aberto_em,
    fechado_em,
    created_at
FROM public.comandas
WHERE fechado_em IS NULL 
  AND status NOT IN ('open', 'awaiting-payment')
ORDER BY codigo_empresa, aberto_em DESC;

-- =====================================================
-- PASSO 2: CORRIGIR comandas inconsistentes
-- =====================================================

-- Opção A: Marcar como fechadas (preencher fechado_em)
-- Use esta opção se as comandas já foram finalizadas mas o fechado_em não foi preenchido
UPDATE public.comandas
SET 
    fechado_em = COALESCE(updated_at, aberto_em, NOW()),
    updated_at = NOW()
WHERE fechado_em IS NULL 
  AND status NOT IN ('open', 'awaiting-payment');

-- =====================================================
-- PASSO 3: VERIFICAR resultado
-- =====================================================

-- Deve retornar 0 linhas (todas corrigidas)
SELECT 
    id,
    codigo_empresa,
    mesa_id,
    status,
    aberto_em,
    fechado_em
FROM public.comandas
WHERE fechado_em IS NULL 
  AND status NOT IN ('open', 'awaiting-payment')
ORDER BY codigo_empresa, aberto_em DESC;

-- =====================================================
-- PASSO 4: Ver comandas realmente abertas agora
-- =====================================================

SELECT 
    id,
    codigo_empresa,
    mesa_id,
    status,
    aberto_em,
    fechado_em
FROM public.comandas
WHERE fechado_em IS NULL 
  AND status IN ('open', 'awaiting-payment')
ORDER BY codigo_empresa, aberto_em DESC;

-- =====================================================
-- CONCLUÍDO
-- =====================================================
-- Após executar este script:
-- 1. Verifique se não há mais comandas inconsistentes
-- 2. Recarregue a página /vendas no f7arena.com
-- 3. Os logs devem mostrar 0 comandas abertas corretamente
-- =====================================================
