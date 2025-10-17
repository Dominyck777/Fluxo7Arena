-- ============================================================================
-- FIX: Erro ao salvar dados da empresa
-- ============================================================================
-- Problema: record "new" has no field "updated_at"
-- Causa: A função set_updated_at() usa o campo "updated_at" mas a tabela
--        empresas usa "atualizado_em"
-- Solução: Recriar a função para usar o campo correto
-- Data: 17/10/2025
-- ============================================================================

-- IMPORTANTE: Execute este SQL no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/[SEU_PROJETO]/sql/new

-- ============================================================================
-- PASSO 1: Verificar a função atual
-- ============================================================================

-- Ver a definição atual da função set_updated_at
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'set_updated_at'
  AND pronamespace = 'public'::regnamespace;

-- ============================================================================
-- PASSO 2: Recriar a função set_updated_at com lógica flexível
-- ============================================================================

-- Remover a função antiga
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;

-- Criar nova função que detecta automaticamente o nome do campo
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Tenta atualizar o campo "updated_at" se existir
  IF TG_TABLE_NAME IN ('mesas', 'comandas', 'colaboradores', 'caixa_sessoes', 
                       'comanda_itens', 'caixa_movimentos', 'finalizadoras', 
                       'agenda_settings', 'pagamentos') THEN
    NEW.updated_at = NOW();
  -- Para a tabela empresas, usa "atualizado_em"
  ELSIF TG_TABLE_NAME = 'empresas' THEN
    NEW.atualizado_em = NOW();
  -- Fallback: tenta updated_at por padrão
  ELSE
    BEGIN
      NEW.updated_at = NOW();
    EXCEPTION
      WHEN undefined_column THEN
        -- Se updated_at não existir, tenta atualizado_em
        NEW.atualizado_em = NOW();
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PASSO 3: Recriar os triggers que usam set_updated_at
-- ============================================================================

-- Trigger para empresas
DROP TRIGGER IF EXISTS empresas_set_updated_at ON public.empresas;
CREATE TRIGGER empresas_set_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger para mesas
DROP TRIGGER IF EXISTS trg_mesas_updated_at ON public.mesas;
CREATE TRIGGER trg_mesas_updated_at
  BEFORE UPDATE ON public.mesas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger para comandas
DROP TRIGGER IF EXISTS trg_comandas_updated_at ON public.comandas;
CREATE TRIGGER trg_comandas_updated_at
  BEFORE UPDATE ON public.comandas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger para colaboradores
DROP TRIGGER IF EXISTS trg_colaboradores_updated_at ON public.colaboradores;
CREATE TRIGGER trg_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger para caixa_sessoes
DROP TRIGGER IF EXISTS trg_caixa_sessoes_updated_at ON public.caixa_sessoes;
CREATE TRIGGER trg_caixa_sessoes_updated_at
  BEFORE UPDATE ON public.caixa_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger para comanda_itens
DROP TRIGGER IF EXISTS trg_comanda_itens_updated_at ON public.comanda_itens;
CREATE TRIGGER trg_comanda_itens_updated_at
  BEFORE UPDATE ON public.comanda_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger para caixa_movimentos
DROP TRIGGER IF EXISTS trg_caixa_movimentos_updated_at ON public.caixa_movimentos;
CREATE TRIGGER trg_caixa_movimentos_updated_at
  BEFORE UPDATE ON public.caixa_movimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger para finalizadoras
DROP TRIGGER IF EXISTS trg_finalizadoras_updated_at ON public.finalizadoras;
CREATE TRIGGER trg_finalizadoras_updated_at
  BEFORE UPDATE ON public.finalizadoras
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger para agenda_settings
DROP TRIGGER IF EXISTS trg_agenda_settings_set_updated_at ON public.agenda_settings;
CREATE TRIGGER trg_agenda_settings_set_updated_at
  BEFORE UPDATE ON public.agenda_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger para pagamentos
DROP TRIGGER IF EXISTS trg_pagamentos_updated_at ON public.pagamentos;
CREATE TRIGGER trg_pagamentos_updated_at
  BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- PASSO 4: Verificar os triggers recriados
-- ============================================================================

-- Listar todos os triggers que usam set_updated_at
SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE p.proname = 'set_updated_at'
  AND c.relnamespace = 'public'::regnamespace
ORDER BY c.relname;

-- ============================================================================
-- PASSO 5: Testar a atualização
-- ============================================================================

-- Teste simples: atualizar uma empresa
-- (Substitua o codigo_empresa pelo seu)
UPDATE public.empresas 
SET nome = nome 
WHERE codigo_empresa = '1004';

-- Verificar se atualizado_em foi atualizado
SELECT 
  codigo_empresa,
  nome,
  criado_em,
  atualizado_em,
  atualizado_em > criado_em AS foi_atualizado
FROM public.empresas
WHERE codigo_empresa = '1004';

-- ============================================================================
-- RESULTADO ESPERADO
-- ============================================================================
-- Após executar este SQL:
-- ✅ A função set_updated_at() agora funciona com ambos os campos
-- ✅ Tabela "empresas" usa "atualizado_em"
-- ✅ Outras tabelas continuam usando "updated_at"
-- ✅ Salvar dados da empresa não gera mais erro
-- ============================================================================

-- ============================================================================
-- ALTERNATIVA: Renomear o campo na tabela empresas
-- ============================================================================
-- Se preferir padronizar tudo para "updated_at", execute:

-- ALTER TABLE public.empresas 
-- RENAME COLUMN atualizado_em TO updated_at;

-- ALTER TABLE public.empresas 
-- RENAME COLUMN criado_em TO created_at;

-- Mas isso pode quebrar outras partes do código que usam "atualizado_em"
-- Por isso, a solução acima (função flexível) é mais segura.
-- ============================================================================

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
