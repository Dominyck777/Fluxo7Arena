-- ===============================================
-- FIX RLS: quadras_dias_funcionamento para Ísis
-- ===============================================
-- PROBLEMA: A Ísis mobile (usuário anônimo) não consegue 
-- verificar se as quadras funcionam nas datas selecionadas
-- porque a tabela quadras_dias_funcionamento não tem 
-- políticas RLS para usuários anônimos
-- ===============================================

-- 1. Verificar se RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'quadras_dias_funcionamento';

-- 2. Habilitar RLS na tabela (se não estiver habilitado)
ALTER TABLE public.quadras_dias_funcionamento ENABLE ROW LEVEL SECURITY;

-- 3. Verificar se há políticas existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'quadras_dias_funcionamento';

-- 4. Remover políticas conflitantes (se existirem)
DROP POLICY IF EXISTS "quadras_dias_funcionamento_select_policy" ON public.quadras_dias_funcionamento;
DROP POLICY IF EXISTS "Allow public read quadras_dias_funcionamento" ON public.quadras_dias_funcionamento;
DROP POLICY IF EXISTS "Isis pode ler dias funcionamento" ON public.quadras_dias_funcionamento;

-- 5. Criar política para SELECT - permite leitura anônima (necessário para Ísis)
CREATE POLICY "Isis pode ler dias funcionamento" ON public.quadras_dias_funcionamento
FOR SELECT 
TO anon, authenticated
USING (codigo_empresa IS NOT NULL);

-- 6. Criar política adicional para quadras (caso não exista)
-- Verificar se a tabela quadras tem política para anônimos
DROP POLICY IF EXISTS "Isis pode ler quadras" ON public.quadras;
CREATE POLICY "Isis pode ler quadras" ON public.quadras
FOR SELECT 
TO anon, authenticated
USING (codigo_empresa IS NOT NULL);

-- 7. Verificar as políticas criadas
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
WHERE tablename IN ('quadras_dias_funcionamento', 'quadras')
ORDER BY tablename, policyname;

-- 8. Testar acesso anônimo às configurações de funcionamento
-- (Este teste deve funcionar mesmo sem autenticação)
SELECT 
  'Teste acesso quadras_dias_funcionamento' as teste,
  COUNT(*) as total_configuracoes
FROM public.quadras_dias_funcionamento 
WHERE codigo_empresa = '1005'; -- Substitua pelo código da sua empresa

-- 9. Testar acesso anônimo às quadras
SELECT 
  'Teste acesso quadras' as teste,
  COUNT(*) as total_quadras
FROM public.quadras 
WHERE codigo_empresa = '1005'; -- Substitua pelo código da sua empresa

-- 10. Verificar se existe configuração para uma data específica
-- (Simula o que a Ísis faz ao verificar disponibilidade)
SELECT 
  'Teste verificação funcionamento' as teste,
  qdf.tipo,
  qdf.dia_semana,
  qdf.data_fechamento,
  qdf.funciona,
  qdf.observacao,
  q.nome as quadra_nome
FROM public.quadras_dias_funcionamento qdf
INNER JOIN public.quadras q ON q.id = qdf.quadra_id
WHERE qdf.codigo_empresa = '1005' -- Substitua pelo código da sua empresa
  AND (
    (qdf.tipo = 'dia_semana' AND qdf.dia_semana = 1) -- Segunda-feira
    OR 
    (qdf.tipo = 'data_fechamento' AND qdf.data_fechamento = CURRENT_DATE)
  )
LIMIT 5;

-- ===============================================
-- INSTRUÇÕES DE EXECUÇÃO
-- ===============================================
-- 1. Abra o Supabase Dashboard
-- 2. Vá em SQL Editor  
-- 3. Cole TODO este código
-- 4. Substitua '1005' pelo código da sua empresa
-- 5. Clique em Run
-- 6. Teste a Ísis mobile novamente
-- ===============================================

-- ===============================================
-- VERIFICAÇÃO FINAL
-- ===============================================
-- Execute este comando para confirmar que tudo funcionou:
SELECT 
  'VERIFICAÇÃO FINAL' as status,
  (
    SELECT COUNT(*) 
    FROM pg_policies 
    WHERE tablename = 'quadras_dias_funcionamento' 
    AND 'anon' = ANY(roles)
  ) as politicas_anonimas_criadas,
  (
    SELECT rowsecurity 
    FROM pg_tables 
    WHERE tablename = 'quadras_dias_funcionamento'
  ) as rls_habilitado;
