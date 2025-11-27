-- ===============================================
-- FIX COMPLETO: RLS para Ísis (Agendamento Público)
-- ===============================================
-- Permite que a Ísis (usuário anônimo) possa:
-- 1. LER agendamentos (verificar disponibilidade)
-- 2. CRIAR agendamentos (fazer reservas)
-- 3. CRIAR participantes (adicionar pessoas)
-- ===============================================

-- ===============================================
-- TABELA: agendamentos
-- ===============================================

-- Política para LEITURA pública (verificar horários disponíveis)
CREATE POLICY "Allow public read agendamentos by codigo_empresa"
ON agendamentos
FOR SELECT
TO anon
USING (codigo_empresa IS NOT NULL);

-- Política para INSERÇÃO pública (criar agendamentos)
CREATE POLICY "Allow public insert agendamentos by codigo_empresa"
ON agendamentos
FOR INSERT
TO anon
WITH CHECK (codigo_empresa IS NOT NULL);

-- ===============================================
-- TABELA: agendamento_participantes
-- ===============================================

-- Política para INSERÇÃO pública (adicionar participantes ao agendamento)
CREATE POLICY "Allow public insert agendamento_participantes by codigo_empresa"
ON agendamento_participantes
FOR INSERT
TO anon
WITH CHECK (codigo_empresa IS NOT NULL);

-- ===============================================
-- INSTRUÇÕES DE USO
-- ===============================================
-- 1. Abra o Supabase Dashboard
-- 2. Vá em SQL Editor
-- 3. Cole TODOS os comandos acima
-- 4. Clique em Run
-- 5. Teste a Ísis novamente

-- ===============================================
-- VERIFICAR POLÍTICAS APLICADAS (opcional)
-- ===============================================
-- SELECT tablename, policyname, cmd, roles 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('agendamentos', 'agendamento_participantes')
-- AND 'anon' = ANY(roles);

-- ===============================================
-- TESTES (opcional - execute no SQL Editor)
-- ===============================================

-- Teste 1: Buscar horários disponíveis
-- SELECT inicio, fim, status 
-- FROM agendamentos 
-- WHERE codigo_empresa = '1005' 
-- AND status != 'canceled'
-- LIMIT 5;

-- Teste 2: Verificar se pode inserir (simule)
-- SELECT 
--   has_table_privilege('anon', 'agendamentos', 'INSERT') as pode_inserir_agendamentos,
--   has_table_privilege('anon', 'agendamento_participantes', 'INSERT') as pode_inserir_participantes;
